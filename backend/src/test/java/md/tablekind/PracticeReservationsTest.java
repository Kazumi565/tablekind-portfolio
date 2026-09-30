package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import md.tablekind.auth.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PracticeReservationsTest extends WorkflowSupport {
  @Autowired AuthService auth;

  @Test void practiceRequestsAreIsolatedIdempotentAndNeverChangeTheBill() {
    String when=Instant.now().plus(2,ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString();
    String path="/api/sessions/"+sid+"/practice-reservations";
    var body=map("when",when,"partySize",3);
    var before=state().path("bill");
    String key=UUID.randomUUID().toString();
    var created=send(at,"POST",path,body,key);
    assertEquals(200,created.status(),created.body().toString());
    assertEquals(created.body(),send(at,"POST",path,body,key).body());
    String id=created.body().path("id").asText();
    assertEquals(409,send(at,"POST",path,body,UUID.randomUUID().toString()).status());
    assertEquals(1,ok(at,"GET",path,null).size());
    assertEquals(0,ok(bt,"GET",path,null).size());
    assertEquals(404,send(bt,"POST",path+"/"+id+"/cancel",Map.of(),UUID.randomUUID().toString()).status());
    assertEquals(403,send(at,"GET","/api/restaurants/"+rid+"/practice-reservations",null,null).status());
    assertEquals(1,ok(staff,"GET","/api/restaurants/"+rid+"/practice-reservations",null).size());
    assertEquals(before,state().path("bill"));
    assertEquals(0,db.number("SELECT count(*) FROM checkout_reservation WHERE session_id=?",UUID.fromString(sid)));
  }

  @Test void onlyThisRestaurantsManagerMayReviewAndGuestCanCancel() {
    String when=Instant.now().plus(3,ChronoUnit.DAYS).toString();
    String id=post(at,"/sessions/"+sid+"/practice-reservations",map("when",when,"partySize",2)).path("id").asText();
    String other=post(staff,"/restaurants",map("name","Foreign " + UUID.randomUUID())).path("id").asText();
    String decision="/api/restaurants/"+rid+"/practice-reservations/"+id+"/decision";
    assertEquals(404,send(staff,"POST","/api/restaurants/"+other+"/practice-reservations/"+id+"/decision",
        map("status","PRACTICE_APPROVED"),UUID.randomUUID().toString()).status());
    assertEquals(403,send(at,"POST",decision,map("status","PRACTICE_APPROVED"),UUID.randomUUID().toString()).status());
    var approved=ok(staff,"POST",decision,map("status","PRACTICE_APPROVED"));
    assertEquals("PRACTICE_APPROVED",approved.path("status").asText());
    assertEquals(409,send(staff,"POST",decision,map("status","DECLINED"),UUID.randomUUID().toString()).status());
    post(at,"/sessions/"+sid+"/practice-reservations/"+id+"/cancel",Map.of());
    assertEquals("CANCELLED",ok(at,"GET","/api/sessions/"+sid+"/practice-reservations",null).get(0).path("status").asText());
  }

  @Test void invalidOrPastSlotsCannotBeCreatedAndWaiterCannotReview() {
    var request=map("when",Instant.now().minus(1,ChronoUnit.DAYS).toString(),"partySize",2);
    fails(400,at,"/sessions/"+sid+"/practice-reservations",request);
    String id=post(staff,"/restaurants/"+rid+"/staff",map("email",UUID.randomUUID()+"@example.test",
        "displayName","Waiter","password","Fixture-Password-2026!","role","WAITER")).path("id").asText();
    String waiter=auth.token(UUID.fromString(id),"STAFF",0).get("accessToken").toString();
    assertEquals(403,send(waiter,"GET","/api/restaurants/"+rid+"/practice-reservations",null,null).status());
    assertEquals(403,send(waiter,"POST","/api/sessions/"+sid+"/practice-reservations",
        map("when",Instant.now().plus(2,ChronoUnit.DAYS).toString(),"partySize",2),UUID.randomUUID().toString()).status());
  }
}
