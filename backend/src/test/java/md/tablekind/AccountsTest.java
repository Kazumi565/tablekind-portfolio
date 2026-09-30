package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.Commands;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/** HTTP/SQL authorization and identity regressions. Requires the native test database. */
class AccountsTest extends WorkflowSupport {
  @Autowired PasswordEncoder passwords;
  @Autowired AuthService auth;
  @Autowired SecretBox box;
  static final String PASSWORD="Customer-Test-Password!";

  JsonNode customer() {
    return post(null,"/customer/register",map("username","guest_"+UUID.randomUUID().toString().replace("-", "").substring(0,20),
        "displayName","Account guest","language","ro","password",PASSWORD));
  }
  String token(JsonNode account) { return account.path("accessToken").asText(); }
  void link(String customer,String guest) { post(customer,"/customer/table-link",map("guestToken",guest)); }
  String member(String role) {
    return post(staff,"/restaurants/"+rid+"/staff",map("email",UUID.randomUUID()+"@example.test","displayName","Fixture staff","password",PASSWORD,"role",role)).path("id").asText();
  }
  String staffToken(String id) { return auth.token(UUID.fromString(id),"STAFF",0).get("accessToken").toString(); }
  String username(JsonNode account) { return ok(token(account),"GET","/api/customer/me",null).path("profile").path("username").asText(); }

  @Test void customerIdentityNeverAuthorizesRestaurantTableOrPlatformAccess() {
    var c=customer();String t=token(c);
    assertEquals(403,send(t,"GET","/api/restaurants/"+rid,null,null).status());
    assertEquals(403,send(t,"GET","/api/sessions/"+sid,null,null).status());
    assertEquals(403,send(t,"GET","/api/platform/overview",null,null).status());
    assertEquals(403,send(staff,"GET","/api/customer/me",null,null).status());
    assertEquals(403,send(at,"GET","/api/customer/me",null,null).status());
    assertEquals(403,send(staff,"GET","/api/platform/overview",null,null).status());
  }

  @Test void optionalLinkAndResumePreserveGuestAmountsAndIdempotencyIdentity() {
    item();var before=state();var c=customer();String t=token(c);link(t,at);link(t,at);
    var resumed=post(t,"/customer/visits/"+a+"/resume",Map.of());
    assertEquals(a,resumed.path("actorId").asText());assertEquals(sid,resumed.path("sessionId").asText());
    assertEquals("GUEST",resumed.path("kind").asText());
    var after=ok(token(resumed),"GET","/api/sessions/"+sid,null);
    assertEquals(before.path("bill"),after.path("bill"));assertEquals(before.path("session").path("revision"),after.path("session").path("revision"));
    assertEquals(2,after.path("guests").size());assertFalse(after.path("guests").get(0).has("customer_id"));
    assertEquals(1,ok(t,"GET","/api/customer/me",null).path("visits").size());
  }

  @Test void customerCannotClaimTwoGuestsOrAnotherAccountsLinkedGuest() {
    var c=customer();String t=token(c);link(t,at);
    fails(409,t,"/customer/table-link",map("guestToken",bt));
    String other=token(customer());fails(409,other,"/customer/table-link",map("guestToken",at));
    fails(403,other,"/customer/visits/"+a+"/resume",Map.of());
    fails(403,t,"/customer/table-link",map("guestToken",staff));
    fails(401,t,"/customer/table-link",map("guestToken","not-a-token"));
  }

  @Test void concurrentAccountLinksCannotClaimTwoGuestsAtOneTable() throws Exception {
    org.junit.jupiter.api.Assumptions.assumeFalse(SUPPLEMENTARY,"Requires native concurrent database sessions");
    var customer=customer();String token=token(customer);
    var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var first=pool.submit(()->send(token,"POST","/api/customer/table-link",map("guestToken",at),UUID.randomUUID().toString()).status());
      var second=pool.submit(()->send(token,"POST","/api/customer/table-link",map("guestToken",bt),UUID.randomUUID().toString()).status());
      var statuses=new ArrayList<>(List.of(first.get(20,java.util.concurrent.TimeUnit.SECONDS),second.get(20,java.util.concurrent.TimeUnit.SECONDS)));
      Collections.sort(statuses);assertEquals(List.of(200,409),statuses);
      assertEquals(1,db.number("SELECT count(*) FROM guest WHERE customer_id=? AND session_id=?",UUID.fromString(customer.path("actorId").asText()),UUID.fromString(sid)));
    } finally { pool.shutdownNow(); }
  }

  @Test void revokedOrClosedGuestsCannotBeResumed() {
    String t=token(customer());link(t,at);
    action(staff,"/guests/"+a+"/revoke");
    fails(403,t,"/customer/visits/"+a+"/resume",Map.of());
    String other=token(customer());link(other,bt);action(staff,"/close");
    fails(409,other,"/customer/visits/"+b+"/resume",Map.of());
  }

  @Test void accountHistoryDoesNotExposeAnotherCustomersVisit() {
    String t=token(customer()),other=token(customer());link(t,at);link(other,bt);
    var visits=ok(t,"GET","/api/customer/me",null).path("visits");
    assertEquals(1,visits.size());assertEquals(a,visits.get(0).path("guest_id").asText());
    assertFalse(visits.toString().contains(b));
  }

  @Test void passwordChangeRevokesCustomerAndLinkedGuestTokensWithoutChangingAmounts() {
    item();String t=token(customer());link(t,at);var before=state().path("bill");
    post(t,"/customer/password",map("password",PASSWORD,"newPassword","Replacement-Password!"));
    assertEquals(401,send(t,"GET","/api/customer/me",null,null).status());
    assertEquals(401,send(at,"GET","/api/sessions/"+sid,null,null).status());
    assertEquals(before,state().path("bill"));assertEquals(200,send(bt,"GET","/api/sessions/"+sid,null,null).status());
  }

  @Test void recoveryIsSingleUseAndDoesNotAcceptUsernameAlone() {
    var c=customer();String name=username(c),old=c.path("recoveryCode").asText();
    fails(401,null,"/customer/recover",map("username",name,"recoveryCode","0".repeat(64),"newPassword","Replacement-Password!"));
    var r=post(null,"/customer/recover",map("username",name,"recoveryCode",old,"newPassword","Replacement-Password!"));
    assertNotEquals(old,r.path("recoveryCode").asText());
    fails(401,null,"/customer/recover",map("username",name,"recoveryCode",old,"newPassword","Replacement-Password!"));
    assertEquals(401,send(token(c),"GET","/api/customer/me",null,null).status());
    post(null,"/customer/login",map("username",name,"password","Replacement-Password!"));
  }

  @Test void deletionWaitsForClosedTablesAndPreservesRestaurantRecords() {
    var c=customer();String t=token(c);link(t,at);
    fails(409,t,"/customer/delete",map("password",PASSWORD));
    action(staff,"/close");long guests=db.number("SELECT count(*) FROM guest WHERE session_id=?",UUID.fromString(sid));
    post(t,"/customer/delete",map("password",PASSWORD));
    assertEquals(401,send(t,"GET","/api/customer/me",null,null).status());
    assertEquals(guests,db.number("SELECT count(*) FROM guest WHERE session_id=?",UUID.fromString(sid)));
    assertNull(db.one("SELECT customer_id FROM guest WHERE id=?",UUID.fromString(a)).get("customer_id"));
  }

  @Test void managerCannotCreateOrRemoveManagersOrModifyOwner() {
    String manager=member("MANAGER"),mt=staffToken(manager),other=member("MANAGER");
    fails(403,mt,"/restaurants/"+rid+"/staff",map("email",UUID.randomUUID()+"@example.test","displayName","Escalation","password",PASSWORD,"role","MANAGER"));
    assertEquals(403,send(mt,"DELETE","/api/restaurants/"+rid+"/staff/"+other,null,UUID.randomUUID().toString()).status());
    assertEquals(403,send(mt,"PUT","/api/restaurants/"+rid+"/staff/"+other+"/role",map("role","WAITER"),UUID.randomUUID().toString()).status());
    String owner=ok(staff,"GET","/api/auth/me",null).path("id").asText();
    assertEquals(409,send(mt,"DELETE","/api/restaurants/"+rid+"/staff/"+owner,null,UUID.randomUUID().toString()).status());
    assertEquals("OWNER",ok(staff,"GET","/api/restaurants/"+rid,null).path("role").asText());
  }

  @Test void ownerCanPromoteWaiterAndManagerCanManageOnlyWaiters() {
    String manager=staffToken(member("MANAGER"));
    var waiter=post(manager,"/restaurants/"+rid+"/staff",map("email",UUID.randomUUID()+"@example.test","displayName","Waiter","password",PASSWORD,"role","WAITER"));
    String id=waiter.path("id").asText();
    ok(staff,"PUT","/api/restaurants/"+rid+"/staff/"+id+"/role",map("role","MANAGER"));
    assertEquals(403,send(manager,"DELETE","/api/restaurants/"+rid+"/staff/"+id,null,UUID.randomUUID().toString()).status());
    ok(staff,"PUT","/api/restaurants/"+rid+"/staff/"+id+"/role",map("role","WAITER"));
    ok(manager,"DELETE","/api/restaurants/"+rid+"/staff/"+id,null);
  }

  @Test void ownershipTransferReplaysButCannotBeUsedToTransferAgainAfterDemotion() {
    String next=member("MANAGER"),key=UUID.randomUUID().toString();var body=map("staffId",next,"reason","Fixture transfer");
    String path="/api/restaurants/"+rid+"/ownership";
    var first=send(staff,"POST",path,body,key);assertEquals(200,first.status());
    assertEquals(first.body(),send(staff,"POST",path,body,key).body());
    assertEquals(403,send(staff,"POST",path,body,UUID.randomUUID().toString()).status());
    assertEquals("MANAGER",ok(staff,"GET","/api/restaurants/"+rid,null).path("role").asText());
    assertEquals("OWNER",ok(staffToken(next),"GET","/api/restaurants/"+rid,null).path("role").asText());
  }

  @Test void crossRestaurantOwnerCannotChangeAnotherRestaurantsStaff() {
    String outsider=member("MANAGER"),t=staffToken(outsider);
    String different=post(t,"/restaurants",map("name","Another owned restaurant")).path("id").asText();
    assertNotEquals(rid,different);
    String colleague=member("WAITER");
    assertEquals(403,send(t,"PUT","/api/restaurants/"+rid+"/staff/"+colleague+"/role",map("role","MANAGER"),UUID.randomUUID().toString()).status());
  }

  record Admin(UUID id,String email,String secret,String token) {}
  Admin admin() {
    UUID id=db.optional("SELECT id FROM platform_account").map(r->md.tablekind.common.Db.id(r,"id")).orElseGet(UUID::randomUUID);
    String email=id+"@example.test",secret=Totp.secret();
    db.update("INSERT INTO platform_account(id,email,password_hash,mfa_secret,recovery_hash) VALUES(?,?,?,?,?)"
        + " ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,mfa_secret=excluded.mfa_secret,"
        + "recovery_hash=excluded.recovery_hash,mfa_last_step=-1,token_version=0,active=true,mfa_pending=NULL,mfa_pending_until=NULL",
        id,email,passwords.encode(PASSWORD),box.seal(id,secret),Commands.hash(AccountPasswords.recoveryCode()));
    return new Admin(id,email,secret,auth.token(id,"PLATFORM",0).get("accessToken").toString());
  }
  Map<String,Object> proof(Admin a) {return map("password",PASSWORD,"code",Totp.code(a.secret,Instant.now().getEpochSecond()/30));}

  @Test void platformRequiresMfaAndRejectsReusedCodes() {
    var a=admin();String code=proof(a).get("code").toString();
    fails(400,null,"/platform/login",map("email",a.email,"password",PASSWORD,"code",""));
    post(null,"/platform/login",map("email",a.email,"password",PASSWORD,"code",code));
    fails(401,null,"/platform/login",map("email",a.email,"password",PASSWORD,"code",code));
  }

  @Test void databaseRejectsASecondPlatformAdministrator() {
    admin();
    assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->db.update(
        "INSERT INTO platform_account(id,email,password_hash,mfa_secret,recovery_hash) VALUES(?,?,?,'fixture','fixture')",
        UUID.randomUUID(),UUID.randomUUID()+"@example.test",passwords.encode(PASSWORD)));
  }

  @Test void platformIdentityHasNoImplicitRestaurantOrGuestAuthority() {
    var a=admin();ok(a.token,"GET","/api/platform/overview",null);
    assertEquals(403,send(a.token,"GET","/api/restaurants/"+rid,null,null).status());
    assertEquals(403,send(a.token,"GET","/api/sessions/"+sid,null,null).status());
    assertEquals(403,send(a.token,"GET","/api/customer/me",null,null).status());
  }

  @Test void platformProvisioningCreatesOwnerAndNoFinancialEntries() {
    var a=admin();var created=post(a.token,"/platform/restaurants",map("name","Provisioned fixture","ownerEmail",UUID.randomUUID()+"@example.test","ownerName","Owner","ownerPassword",PASSWORD,"reason","Fixture provisioning","proof",proof(a)));
    UUID id=UUID.fromString(created.path("restaurantId").asText());
    assertEquals(1,db.number("SELECT count(*) FROM membership WHERE restaurant_id=? AND role='OWNER'",id));
    assertEquals(0,db.number("SELECT count(*) FROM bill_entry WHERE restaurant_id=?",id));
    assertEquals(1,db.number("SELECT count(*) FROM platform_audit WHERE restaurant_id=? AND action='RESTAURANT_PROVISIONED'",id));
  }

  @Test void platformCanAssignLegacyManagerButCannotOverwriteOwner() {
    var admin=admin();String manager=member("MANAGER");String email=DbText(manager);
    fails(409,admin.token,"/platform/restaurants/"+rid+"/owner",map("ownerEmail",email,"reason","Fixture review","proof",proof(admin)));
    db.update("UPDATE membership SET role='MANAGER' WHERE restaurant_id=? AND role='OWNER'",UUID.fromString(rid));
    post(admin.token,"/platform/restaurants/"+rid+"/owner",map("ownerEmail",email,"reason","Fixture review","proof",proof(admin)));
    assertEquals("OWNER",ok(staffToken(manager),"GET","/api/restaurants/"+rid,null).path("role").asText());
  }
  @Test void administratorReplacementRequiresNewAuthenticatorBeforeRevokingOldSecurity() {
    var admin=admin();String before=db.one("SELECT mfa_secret FROM platform_account WHERE id=?",admin.id).get("mfa_secret").toString();
    var setup=post(admin.token,"/platform/security/setup",map("password",PASSWORD));
    assertEquals(before,db.one("SELECT mfa_secret FROM platform_account WHERE id=?",admin.id).get("mfa_secret"));
    fails(400,admin.token,"/platform/security",map("password",PASSWORD,"newPassword","Replace-Admin-Password!","newCode","bad"));
    var changed=post(admin.token,"/platform/security",map("password",PASSWORD,"newPassword","Replace-Admin-Password!",
        "newCode",Totp.code(setup.path("secret").asText(),Instant.now().getEpochSecond()/30)));
    assertEquals(401,send(admin.token,"GET","/api/platform/overview",null,null).status());
    post(null,"/platform/login",map("email",admin.email,"password","Replace-Admin-Password!","code",changed.path("recoveryCode").asText()));
  }

  @Test void waiterAndRemovedStaffCannotCreateRestaurantsOrReplayPrivilegedReceipts() {
    String id=member("WAITER"),waiter=staffToken(id);
    fails(403,waiter,"/restaurants",map("name","Forbidden fixture"));
    ok(staff,"DELETE","/api/restaurants/"+rid+"/staff/"+id,null);
    fails(403,waiter,"/restaurants",map("name","Still forbidden"));
    String manager=member("MANAGER"),key=UUID.randomUUID().toString();
    var body=map("role","WAITER");String path="/api/restaurants/"+rid+"/staff/"+manager+"/role";
    assertEquals(200,send(staff,"PUT",path,body,key).status());
    String next=member("MANAGER");post(staff,"/restaurants/"+rid+"/ownership",map("staffId",next,"reason","Fixture transfer"));
    assertEquals(403,send(staff,"PUT",path,body,key).status());
  }
  String DbText(String id) {return db.one("SELECT email FROM staff_account WHERE id=?",UUID.fromString(id)).get("email").toString();}
}
