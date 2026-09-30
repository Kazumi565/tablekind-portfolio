package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class OperationsTest extends WorkflowSupport {
  @Test
  void scopedReadOnlyStatusRequiresManager() {
    long before = db.number("SELECT count(*) FROM audit_event");
    var r = ok(staff, "GET", "/api/restaurants/" + rid + "/operations", null);
    assertEquals("OK", r.path("status").asText());
    assertTrue(r.path("testOnly").asBoolean());
    assertEquals(0, r.path("counts").path("queuedPos").asInt());
    assertEquals(before, db.number("SELECT count(*) FROM audit_event"));
    assertEquals(
        403, send(at, "GET", "/api/restaurants/" + rid + "/operations", null, null).status());
    var staffId = ok(staff, "GET", "/api/auth/me", null).path("id").asText();
    db.update(
        "UPDATE membership SET role='WAITER' WHERE restaurant_id=? AND staff_id=?",
        UUID.fromString(rid),
        UUID.fromString(staffId));
    assertEquals(
        403, send(staff, "GET", "/api/restaurants/" + rid + "/operations", null, null).status());
  }

  @Test
  void statusCannotCrossRestaurantMembership() {
    String other = UUID.randomUUID().toString();
    db.update(
        "INSERT INTO restaurant(id,name) VALUES(?,?)", UUID.fromString(other), "Other tenant");
    assertEquals(
        403, send(staff, "GET", "/api/restaurants/" + other + "/operations", null, null).status());
  }

  @Test
  void oldPaymentsAlertWithoutReleasingOrSettlingThem() {
    item();
    var p =
        action(
            at,
            "/payments",
            "target",
            "SELF",
            "guestIds",
            List.of(),
            "method",
            "CARD",
            "tipBani",
            0);
    db.update(
        "UPDATE payment_attempt SET created_at=now()-interval '11 minutes' WHERE id=?",
        UUID.fromString(p.path("id").asText()));
    var r = ok(staff, "GET", "/api/restaurants/" + rid + "/operations", null);
    assertEquals(1, r.path("counts").path("oldPayments").asInt());
    assertTrue(r.path("alerts").toString().contains("PAYMENT_PENDING"));
    assertEquals(10001, state().path("bill").path("reservedBani").asLong());
    assertEquals(0, state().path("bill").path("paidBani").asLong());
  }

  @Test
  void pausedPosIsVisibleOnlyInItsRestaurant() {
    // Connecting requires no active sessions; isolate the connection on a fresh restaurant.
    String other =
        post(staff, "/restaurants", map("name", "Operational fixture")).path("id").asText();
    post(staff, "/restaurants/" + other + "/pos/connect-test", map());
    post(staff, "/restaurants/" + other + "/pos/pause", map("paused", true));
    var r = ok(staff, "GET", "/api/restaurants/" + other + "/operations", null);
    assertTrue(r.path("alerts").toString().contains("POS_PAUSED"));
    assertFalse(
        ok(staff, "GET", "/api/restaurants/" + rid + "/operations", null)
            .path("posPaused")
            .asBoolean());
  }

  @Test
  void probesArePublicAndDoNotExposeDatabaseDetails() {
    for (String path : List.of("/actuator/health/liveness", "/actuator/health/readiness")) {
      var r = send(null, "GET", path, null, null);
      assertEquals(200, r.status());
      assertEquals("UP", r.body().path("status").asText());
      assertFalse(r.body().has("components"));
      assertFalse(r.body().has("details"));
    }
    assertEquals(401, send(null, "GET", "/actuator/env", null, null).status());
    assertEquals(401, send(null, "GET", "/actuator/metrics", null, null).status());
  }
}
