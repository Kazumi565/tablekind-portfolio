package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import md.tablekind.auth.AuthService;
import md.tablekind.common.Db;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** HTTP checks run against the same authorization path used by the browser. */
class PilotBoundariesTest extends WorkflowSupport {
  @Autowired AuthService auth;

  String waiter() {
    String id=post(staff,"/restaurants/"+rid+"/staff",map("email",UUID.randomUUID()+"@example.test",
        "displayName","Waiter","password","Fixture-Password-2026!","role","WAITER")).path("id").asText();
    return auth.token(UUID.fromString(id),"STAFF",0).get("accessToken").toString();
  }

  @Test void guestCannotOpenWaiterManagerOrPlatformActions() {
    assertEquals(403,send(at,"GET","/api/restaurants/"+rid,null,null).status());
    assertEquals(403,send(at,"POST","/api/restaurants/"+rid+"/tables/"+tid+"/sessions",Map.of(),UUID.randomUUID().toString()).status());
    assertEquals(403,send(at,"GET","/api/restaurants/"+rid+"/pilot",null,null).status());
    assertEquals(403,send(at,"POST","/api/restaurants/"+rid+"/starter",
        starterBody(),UUID.randomUUID().toString()).status());
    assertEquals(403,send(at,"GET","/api/platform/overview",null,null).status());
  }

  @Test void waiterCannotChangeManagerSettingsOrSeePilotReport() {
    String t=waiter();
    assertEquals(403,send(t,"PUT","/api/restaurants/"+rid+"/branches/"+bid+"/policy",
        map("operatingMode","ORDER_AND_PAY","languages",List.of("en"),"defaultLanguage","en"),UUID.randomUUID().toString()).status());
    assertEquals(403,send(t,"POST","/api/restaurants/"+rid+"/starter",starterBody(),UUID.randomUUID().toString()).status());
    assertEquals(403,send(t,"GET","/api/restaurants/"+rid+"/pilot",null,null).status());
    assertEquals(403,send(t,"GET","/api/platform/overview",null,null).status());
  }

  @Test void managerCannotAccessAnotherRestaurantsSetupOrMeasurements() {
    String other=post(staff,"/restaurants",map("name","Other " + UUID.randomUUID())).path("id").asText();
    String id=post(staff,"/restaurants/"+rid+"/staff",map("email",UUID.randomUUID()+"@example.test",
        "displayName","Manager","password","Fixture-Password-2026!","role","MANAGER")).path("id").asText();
    String t=auth.token(UUID.fromString(id),"STAFF",0).get("accessToken").toString();
    assertEquals(403,send(t,"GET","/api/restaurants/"+other,null,null).status());
    assertEquals(403,send(t,"GET","/api/restaurants/"+other+"/pilot",null,null).status());
    assertEquals(403,send(t,"POST","/api/restaurants/"+other+"/starter",starterBody(),UUID.randomUUID().toString()).status());
    assertEquals(403,send(t,"GET","/api/platform/overview",null,null).status());
  }

  @Test void noPublicPlatformRegistrationExists() {
    long before=db.number("SELECT count(*) FROM platform_account");
    assertEquals(401,send(null,"POST","/api/platform/register",Map.of(),UUID.randomUUID().toString()).status());
    assertEquals(403,send(staff,"POST","/api/platform/register",Map.of(),UUID.randomUUID().toString()).status());
    assertEquals(before,db.number("SELECT count(*) FROM platform_account"));
  }

  @Test void oneStepSetupIsAtomicScopedAndIdempotent() {
    String fresh=post(staff,"/restaurants",map("name","Starter " + UUID.randomUUID())).path("id").asText();
    String path="/api/restaurants/"+fresh+"/starter",key=UUID.randomUUID().toString();
    var first=send(staff,"POST",path,starterBody(),key);
    assertEquals(200,first.status(),first.body().toString());
    assertEquals(first.body(),send(staff,"POST",path,starterBody(),key).body());
    assertEquals(1,db.number("SELECT count(*) FROM branch WHERE restaurant_id=?",UUID.fromString(fresh)));
    assertEquals(1,db.number("SELECT count(*) FROM dining_table WHERE restaurant_id=? AND qr_version IS NOT NULL",UUID.fromString(fresh)));
    assertEquals(1,db.number("SELECT count(*) FROM product WHERE restaurant_id=? AND price_bani=5501",UUID.fromString(fresh)));
    assertEquals(409,send(staff,"POST",path,starterBody(),UUID.randomUUID().toString()).status());
    assertEquals(200,send(staff,"GET","/api/restaurants/"+fresh+"/onboarding",null,null).status());
  }

  @Test void countsAreRestaurantScopedAndReplaysDoNotCreateNewJoins() {
    String path="/api/restaurants/"+rid+"/pilot";
    long joins=ok(staff,"GET",path,null).path("counts").path("TABLE_JOIN").asLong();
    assertEquals(2,joins);
    ok(null,"GET","/api/join/"+join,null);
    assertEquals(1,ok(staff,"GET",path,null).path("counts").path("QR_SCAN").asLong());
    item();
    assertEquals(1,ok(staff,"GET",path,null).path("counts").path("ORDER_SUBMITTED").asLong());
    assertEquals(0,ok(staff,"GET",path,null).path("counts").path("PAYMENT_COMPLETED").asLong());
    String other=post(staff,"/restaurants",map("name","Empty " + UUID.randomUUID())).path("id").asText();
    assertEquals(0,ok(staff,"GET","/api/restaurants/"+other+"/pilot",null).path("counts").path("TABLE_JOIN").asLong());
  }

  @Test void settledPracticeTableCountsCoordinationOnce() {
    String order=item();
    String payment=action(at,"/payments","target","SELF","guestIds",List.of(),"payerId",null,"amountBani",10001,
        "method","CASH","tipBani",0).path("id").asText();
    action(staff,"/payments/"+payment+"/confirm","receivedBani",10001,"reference","","collected",true);
    for(String status:List.of("PREPARING","READY","SERVED"))
      action(staff,"/orders/"+order+"/status","status",status,"reason","");
    action(staff,"/close");
    var counts=ok(staff,"GET","/api/restaurants/"+rid+"/pilot",null).path("counts");
    assertEquals(1,counts.path("PAYMENT_COMPLETED").asLong());
    assertEquals(1,counts.path("COORDINATION_COMPLETED").asLong());
  }

  @Test void authorizedFlowErrorsAreAggregatedWithoutExposingGuests() {
    assertEquals(400,send(at,"POST","/api/sessions/"+sid+"/orders",Map.of(),UUID.randomUUID().toString()).status());
    var report=ok(staff,"GET","/api/restaurants/"+rid+"/pilot",null);
    assertEquals(1,report.path("counts").path("FLOW_ERROR").asLong());
    assertFalse(report.toString().contains("Mihai"));
    assertFalse(report.toString().contains(a));
    assertFalse(report.toString().contains(join));
  }

  Map<String,Object> starterBody() { return map("branchName","Main","tableLabel","Table 1",
      "categoryName","Food","productName","Soup","priceBani",5501); }
}
