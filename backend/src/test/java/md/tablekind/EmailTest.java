package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import md.tablekind.auth.SecretBox;
import md.tablekind.common.Db;
import md.tablekind.customer.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Native HTTP/SQL email security tests. Delivery is mocked, never sent to a real mailbox. */
@TestPropertySource(properties={"tablekind.email.mode=LOCAL_SMTP","tablekind.email.worker-enabled=false"})
class EmailTest extends WorkflowSupport {
  @Autowired SecretBox box;
  @Autowired EmailWorker worker;
  @MockitoBean LocalEmailDelivery delivery;
  static final String PASSWORD="Local-Email-Fixture!";

  record Customer(String username,String email,UUID id,String token) {}
  Customer customer() {
    String name="email_"+UUID.randomUUID().toString().replace("-","").substring(0,18);
    return customer(name+"@example.test",name);
  }
  Customer customer(String email,String name) {
    var r=post(null,"/customer/register",map("username",name,"email",email,"displayName","Email guest","language","en","password",PASSWORD));
    return new Customer(name,email,UUID.fromString(r.path("actorId").asText()),r.path("accessToken").asText());
  }
  Map<String,Object> challenge(Customer c,String purpose) {
    return db.one("SELECT * FROM customer_email_challenge WHERE customer_id=? AND purpose=?",c.id,purpose);
  }
  String code(Customer c,String purpose) {
    var row=challenge(c,purpose);return box.open(Db.id(row,"id"),Db.text(row,"payload"));
  }
  void verify(Customer c) {post(c.token,"/customer/email/verify",map("code",code(c,"VERIFY")));}
  void resetRequest(Customer c) {post(null,"/customer/email/reset/request",map("username",c.username,"email",c.email));}
  Map<String,Object> resetBody(Customer c,String code) {return map("username",c.username,"email",c.email,"code",code,"newPassword","Replacement-Email-Fixture!");}
  JsonNode profile(Customer c) {return ok(c.token,"GET","/api/customer/me",null).path("profile");}

  @Test void enabledRegistrationRequiresEmailAndRollsBackOnMissingAddress() {
    String name="missing_"+UUID.randomUUID().toString().substring(0,8);
    fails(400,null,"/customer/register",map("username",name,"displayName","Missing email","language","en","password",PASSWORD));
    assertEquals(0,db.number("SELECT count(*) FROM customer_account WHERE username=?",name));
    assertEquals(200,send(at,"GET","/api/sessions/"+sid,null,null).status());
  }

  @Test void accountRequiresVerificationBeforeLinkingAndResumingWithoutChangingBill() {
    item();var before=state().path("bill");Customer c=customer();
    fails(403,c.token,"/customer/table-link",map("guestToken",at));
    String code=code(c,"VERIFY");verify(c);
    assertEquals("LOCAL_SMTP",profile(c).path("email_verification_mode").asText());
    assertTrue(profile(c).path("pending_email").isNull());
    post(c.token,"/customer/table-link",map("guestToken",at));
    var resumed=post(c.token,"/customer/visits/"+a+"/resume",Map.of());assertEquals(a,resumed.path("actorId").asText());
    assertEquals(before,state().path("bill"));
    fails(400,c.token,"/customer/email/verify",map("code",code));
    db.update("UPDATE customer_account SET email_verification_mode='OTHER_MODE' WHERE id=?",c.id);
    fails(403,c.token,"/customer/visits/"+a+"/resume",Map.of());
  }

  @Test void fiveWrongCodesCommitAttemptsAndLockTheChallenge() {
    Customer c=customer();String valid=code(c,"VERIFY"),wrong=valid.equals("00000000") ? "11111111" : "00000000";
    for(int i=1;i<=5;i++) {
      fails(400,c.token,"/customer/email/verify",map("code",wrong));
      assertEquals(i,Db.amount(challenge(c,"VERIFY"),"attempts"));
    }
    fails(400,c.token,"/customer/email/verify",map("code",valid));
    assertNull(challenge(c,"VERIFY").get("payload"));
    assertTrue(profile(c).path("email_verified_at").isNull());
  }

  @Test void expiredCodeCannotVerifyAndWorkerClearsSecretMaterial() {
    Customer c=customer();String code=code(c,"VERIFY");
    db.update("UPDATE customer_email_challenge SET expires_at=now()-interval '1 second' WHERE customer_id=?",c.id);
    fails(400,c.token,"/customer/email/verify",map("code",code));
    worker.deliverOne();
    assertNull(challenge(c,"VERIFY").get("payload"));assertEquals("",Db.text(challenge(c,"VERIFY"),"code_hash"));
  }

  @Test void resendHonoursCooldownAndReplacesTheOldChallenge() {
    Customer c=customer();String old=code(c,"VERIFY");UUID id=Db.id(challenge(c,"VERIFY"),"id");
    fails(429,c.token,"/customer/email/resend",Map.of());
    db.update("UPDATE customer_email_challenge SET created_at=now()-interval '61 seconds' WHERE customer_id=?",c.id);
    post(c.token,"/customer/email/resend",Map.of());
    assertNotEquals(id,Db.id(challenge(c,"VERIFY"),"id"));
    // Bind the prior code to the prior challenge even if random digits happen to match.
    assertEquals(1,db.number("SELECT count(*) FROM customer_email_challenge WHERE customer_id=?",c.id));
    if(!old.equals(code(c,"VERIFY"))) fails(400,c.token,"/customer/email/verify",map("code",old));
    verify(c);
  }

  @Test void resetRequestsDoNotRevealUnknownOrUnverifiedAccounts() {
    Customer c=customer();
    var unknown=post(null,"/customer/email/reset/request",map("username","unknown_fixture","email","unknown@example.test"));
    var unverified=post(null,"/customer/email/reset/request",map("username",c.username,"email",c.email));
    assertEquals(unknown,unverified);
    assertEquals(0,db.number("SELECT count(*) FROM customer_email_challenge WHERE customer_id=? AND purpose='RESET'",c.id));
    verify(c);assertEquals(unknown,post(null,"/customer/email/reset/request",map("username",c.username,"email",c.email)));
  }

  @Test void resetIsSingleUseAndRevokesAccountAndLinkedGuestTokens() {
    item();Customer c=customer();verify(c);post(c.token,"/customer/table-link",map("guestToken",at));var before=state().path("bill");
    resetRequest(c);String code=code(c,"RESET");post(null,"/customer/email/reset/confirm",resetBody(c,code));
    fails(400,null,"/customer/email/reset/confirm",resetBody(c,code));
    assertEquals(401,send(c.token,"GET","/api/customer/me",null,null).status());
    assertEquals(401,send(at,"GET","/api/sessions/"+sid,null,null).status());
    assertEquals(200,send(bt,"GET","/api/sessions/"+sid,null,null).status());assertEquals(before,state().path("bill"));
    post(null,"/customer/login",map("username",c.username,"password","Replacement-Email-Fixture!"));
    assertEquals("",db.one("SELECT recovery_hash FROM customer_account WHERE id=?",c.id).get("recovery_hash"));
  }

  @Test void verificationCodeCannotResetPasswordAndResetAttemptsPersist() {
    Customer c=customer();String verifyCode=code(c,"VERIFY");
    fails(400,null,"/customer/email/reset/confirm",resetBody(c,verifyCode));verify(c);resetRequest(c);
    String wrong=code(c,"RESET").equals("00000000") ? "11111111" : "00000000";
    fails(400,null,"/customer/email/reset/confirm",resetBody(c,wrong));
    assertEquals(1,Db.amount(challenge(c,"RESET"),"attempts"));
  }

  @Test void emailChangeRequiresPasswordAndKeepsPreviousAddressUntilVerified() {
    Customer c=customer();verify(c);resetRequest(c);String oldReset=code(c,"RESET");
    String next="next_"+c.email;
    fails(401,c.token,"/customer/email/request",map("email",next,"password","wrong"));
    db.update("UPDATE customer_email_challenge SET created_at=now()-interval '61 seconds' WHERE customer_id=? AND purpose='VERIFY'",c.id);
    post(c.token,"/customer/email/request",map("email",next,"password",PASSWORD));
    assertEquals(c.email,profile(c).path("email").asText());assertEquals(next,profile(c).path("pending_email").asText());
    verify(c);assertEquals(next,profile(c).path("email").asText());
    fails(400,null,"/customer/email/reset/confirm",resetBody(c,oldReset));
  }

  @Test void unverifiedSignupDoesNotReserveAnEmailAndVerifiedOwnershipCannotBeStolen() {
    Customer c=customer(),other=customer(c.email,"second_"+UUID.randomUUID().toString().replace("-","").substring(0,18));
    verify(other);fails(400,c.token,"/customer/email/verify",map("code",code(c,"VERIFY")));
    assertTrue(profile(c).path("email_verified_at").isNull());assertEquals(c.email,profile(other).path("email").asText());
  }

  @Test void securityChangesAndDeletionInvalidateOutstandingCodes() {
    Customer c=customer();verify(c);resetRequest(c);
    post(c.token,"/customer/password",map("password",PASSWORD,"newPassword","New-Email-Fixture!"));
    assertEquals(0,db.number("SELECT count(*) FROM customer_email_challenge WHERE customer_id=?",c.id));
    Customer deleted=customer();post(deleted.token,"/customer/delete",map("password",PASSWORD));
    var row=db.one("SELECT email,pending_email,email_verified_at FROM customer_account WHERE id=?",deleted.id);
    assertTrue(row.values().stream().allMatch(Objects::isNull));
    assertEquals(0,db.number("SELECT count(*) FROM customer_email_challenge WHERE customer_id=?",deleted.id));
  }

  @Test void localQueueEncryptsCodesAndRetriesDeliveryWithoutReturningCodesToClients() {
    Customer c=customer();String code=code(c,"VERIFY");var row=challenge(c,"VERIFY");
    assertNotEquals(code,Db.text(row,"code_hash"));assertFalse(Db.text(row,"payload").contains(code));
    assertFalse(ok(c.token,"GET","/api/customer/me",null).toString().contains(code));
    // Isolate this worker fixture from mail queued by preceding HTTP tests.
    db.update("UPDATE customer_email_challenge SET next_attempt_at=now()+interval '1 hour' WHERE customer_id<>?",c.id);
    doThrow(new org.springframework.mail.MailSendException("fixture failure")).when(delivery).send(anyString(),anyString(),anyString());
    worker.deliverOne();assertEquals(1,Db.amount(challenge(c,"VERIFY"),"delivery_attempts"));
    assertEquals("QUEUED",Db.text(challenge(c,"VERIFY"),"delivery_status"));
    reset(delivery);db.update("UPDATE customer_email_challenge SET next_attempt_at=now() WHERE customer_id=?",c.id);
    worker.deliverOne();org.mockito.Mockito.verify(delivery).send(c.email,"VERIFY",code);
    assertEquals("SENT",Db.text(challenge(c,"VERIFY"),"delivery_status"));assertNull(challenge(c,"VERIFY").get("payload"));
  }

  @Test void concurrentVerificationConsumesTheCodeOnce() throws Exception {
    org.junit.jupiter.api.Assumptions.assumeFalse(SUPPLEMENTARY,"Requires native concurrent database sessions");
    Customer c=customer();String code=code(c,"VERIFY");var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var first=pool.submit(()->send(c.token,"POST","/api/customer/email/verify",map("code",code),null).status());
      var second=pool.submit(()->send(c.token,"POST","/api/customer/email/verify",map("code",code),null).status());
      var statuses=new ArrayList<>(List.of(first.get(20,java.util.concurrent.TimeUnit.SECONDS),second.get(20,java.util.concurrent.TimeUnit.SECONDS)));
      Collections.sort(statuses);assertEquals(List.of(200,400),statuses);
    } finally {pool.shutdownNow();}
  }
}
