package md.tablekind.ops;

import java.time.Instant;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.pos.PosWorker;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Read-only, restaurant-scoped operational signals. No financial state is inferred or repaired. */
@RestController
public class Operations {
  private final Db db;
  private final Access access;
  private final PosWorker worker;

  public Operations(Db db, Access access, PosWorker worker) {
    this.db = db;
    this.access = access;
    this.worker = worker;
  }

  @GetMapping("/api/restaurants/{rid}/operations")
  public ResponseEntity<?> status(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid) {
    access.manager(Actor.from(jwt), rid);
    var counts = new LinkedHashMap<String, Long>();
    counts.put(
        "queuedPos",
        db.number(
            "SELECT count(*) FROM pos_outbox WHERE restaurant_id=? AND status<>'DELIVERED'", rid));
    counts.put(
        "failedPos",
        db.number(
            "SELECT count(*) FROM pos_outbox WHERE restaurant_id=? AND status='FAILED'", rid));
    counts.put(
        "oldestPosSeconds",
        db.number(
            "SELECT coalesce(max(extract(epoch FROM now()-created_at)),0)::bigint FROM pos_outbox"
                + " WHERE restaurant_id=? AND status<>'DELIVERED'",
            rid));
    counts.put(
        "pendingPayments",
        db.number(
            "SELECT count(*) FROM payment_attempt WHERE restaurant_id=? AND status='PENDING'",
            rid));
    counts.put(
        "oldPayments",
        db.number(
            "SELECT count(*) FROM payment_attempt WHERE restaurant_id=? AND status='PENDING' AND"
                + " created_at<now()-interval '10 minutes'",
            rid));
    counts.put(
        "oldRefunds",
        db.number(
            "SELECT count(*) FROM payment_refund WHERE restaurant_id=? AND status='PENDING' AND"
                + " created_at<now()-interval '10 minutes'",
            rid));
    counts.put(
        "posDifferences",
        db.number(
            "SELECT count(*) FROM pos_session WHERE restaurant_id=? AND"
                + " reconciliation->>'status'='MISMATCH'",
            rid));
    boolean paused =
        db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=? AND paused", rid) > 0;
    boolean configured =
        db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=?", rid) > 0;
    var workerState = worker.health();
    var alerts = new ArrayList<Map<String, String>>();
    if (counts.get("failedPos") > 0)
      alert(
          alerts,
          "POS_FAILED",
          "critical",
          "POS delivery needs review. Reconcile before retrying the same message.");
    if (paused)
      alert(
          alerts,
          "POS_PAUSED",
          "warning",
          "POS delivery is paused. Pending work stays queued until resumed.");
    if (counts.get("oldestPosSeconds") >= 120)
      alert(
          alerts,
          "POS_BACKLOG",
          "warning",
          "POS work has waited at least two minutes. Check connection and delivery status.");
    if (counts.get("oldPayments") > 0)
      alert(
          alerts,
          "PAYMENT_PENDING",
          "warning",
          "Payments have been pending for ten minutes. Check the provider or verify cash"
              + " collection; never assume they failed.");
    if (counts.get("oldRefunds") > 0)
      alert(
          alerts,
          "REFUND_PENDING",
          "warning",
          "Refunds need confirmation. Do not issue a second refund to resolve an uncertain"
              + " result.");
    if (counts.get("posDifferences") > 0)
      alert(
          alerts,
          "POS_DIFFERENCE",
          "critical",
          "A saved POS comparison has a difference. Compare again after delivery catches up; do not"
              + " rewrite the customer bill.");
    if (configured
        && (!"RUNNING".equals(workerState.get("status"))
            || Boolean.TRUE.equals(workerState.get("recentFailure"))))
      alert(
          alerts,
          "WORKER_NOT_READY",
          "warning",
          "The local POS worker is not confirmed healthy. Check backend logs and refresh.");
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(
            Map.of(
                "observedAt",
                Instant.now().toString(),
                "status",
                alerts.isEmpty() ? "OK" : "ATTENTION",
                "testOnly",
                true,
                "counts",
                counts,
                "alerts",
                alerts,
                "worker",
                workerState,
                "posConfigured",
                configured,
                "posPaused",
                paused));
  }

  private void alert(
      List<Map<String, String>> alerts, String code, String severity, String message) {
    alerts.add(Map.of("code", code, "severity", severity, "message", message));
  }
}
