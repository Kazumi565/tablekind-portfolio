package md.tablekind.restaurant;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.Db;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
public class PilotMetrics {
  private final Db db;
  private final Access access;

  public PilotMetrics(Db db, Access access) {
    this.db = db;
    this.access = access;
  }

  public void scan(UUID restaurant) { count(restaurant, "QR_SCAN"); }

  private void count(UUID restaurant, String event) {
    db.update("INSERT INTO pilot_daily_count(restaurant_id,day,event,count) VALUES(?,(now() AT TIME ZONE 'UTC')::date,?,1)"
        + " ON CONFLICT (restaurant_id,day,event) DO UPDATE SET count=pilot_daily_count.count+1",
        restaurant, event);
  }

  /** Errors are counted only when an authenticated actor already belongs to this restaurant. */
  public void error(HttpServletRequest request) {
    try {
      var auth = SecurityContextHolder.getContext().getAuthentication();
      if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) return;
      Actor actor = Actor.from(jwt);
      String[] path = request.getRequestURI().split("/");
      if (path.length < 4 || !"api".equals(path[1])) return;
      UUID restaurant;
      if ("restaurants".equals(path[2]) && actor.staff()) {
        restaurant = UUID.fromString(path[3]);
        access.staff(actor, restaurant);
      } else if ("sessions".equals(path[2]) && (actor.staff() || actor.guest())) {
        restaurant = Db.id(access.session(actor, UUID.fromString(path[3])), "restaurant_id");
      } else return;
      count(restaurant, "FLOW_ERROR");
    } catch (RuntimeException ignored) {
      // Reporting cannot mask the original API error (including database outages).
    }
  }

  public Object report(Actor actor, UUID restaurant, int days) {
    access.manager(actor, restaurant);
    if (days < 1 || days > 90) throw md.tablekind.common.Problem.bad("Choose 1 to 90 days.");
    LocalDate from = LocalDate.now(ZoneOffset.UTC).minusDays(days - 1);
    var rows = db.list("SELECT day,event,count FROM pilot_daily_count WHERE restaurant_id=? AND day>=?"
        + " ORDER BY day,event", restaurant, from);
    Map<String, Long> totals = new LinkedHashMap<>();
    for (String key : List.of("QR_SCAN", "TABLE_JOIN", "ORDER_SUBMITTED", "SHARE_ACCEPTED",
        "SHARE_REJECTED", "PAYMENT_COMPLETED", "COORDINATION_COMPLETED", "FLOW_ERROR")) totals.put(key, 0L);
    for (var row : rows) totals.computeIfPresent(Db.text(row, "event"), (k, n) -> n + Db.amount(row, "count"));
    // These are unmatched steps, not identified people; repeat visits and historic cohorts overlap.
    long noJoin = Math.max(0, totals.get("QR_SCAN") - totals.get("TABLE_JOIN"));
    long noOrder = Math.max(0, totals.get("TABLE_JOIN") - totals.get("ORDER_SUBMITTED"));
    return Map.of("fromUtc", from.toString(), "throughUtc", LocalDate.now(ZoneOffset.UTC).toString(),
        "counts", totals, "daily", rows,
        "unmatchedScansEstimate", noJoin, "unmatchedJoinsEstimate", noOrder,
        "note", "TEST pilot counts, not unique people. Repeat views, visits across days, staff actions and different checkout choices affect the estimates.");
  }
}
