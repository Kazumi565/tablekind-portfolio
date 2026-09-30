package md.tablekind.session;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.pos.PosSnapshots;
import md.tablekind.restaurant.CatalogService;
import md.tablekind.restaurant.PilotMetrics;
import org.springframework.stereotype.Service;

@Service
public class Sessions {
  private final Db db;
  private final Access access;
  private final AuthService auth;
  private final CatalogService catalog;
  private final PilotMetrics metrics;
  private final PosSnapshots pos;
  private final SecureRandom random = new SecureRandom();

  public Sessions(
      Db db, Access access, AuthService auth, CatalogService catalog, PosSnapshots pos, PilotMetrics metrics) {
    this.db = db;
    this.access = access;
    this.auth = auth;
    this.catalog = catalog;
    this.pos = pos;
    this.metrics = metrics;
  }

  public Map<String, Object> lock(Actor a, UUID sid, long expected) {
    access.session(a, sid);
    var row = db.one("SELECT * FROM table_session WHERE id=? FOR UPDATE", sid);
    if (!Db.text(row, "status").equals("OPEN"))
      throw Problem.conflict("This table session is closed.");
    if (Db.amount(row, "revision") != expected)
      throw new Problem(
          409, "STALE_REVISION", "The table changed. Review the latest state and submit again.");
    return row;
  }

  public void event(Actor a, Map<String, Object> session, String action, Object detail) {
    UUID sid = Db.id(session, "id");
    db.update("UPDATE table_session SET revision=revision+1 WHERE id=?", sid);
    db.update(
        "INSERT INTO audit_event(restaurant_id,session_id,actor_id,action,detail)"
            + " VALUES(?,?,?,?,?::jsonb)",
        Db.id(session, "restaurant_id"),
        sid,
        a.id(),
        action,
        db.json(detail));
    pos.capture(Db.id(session, "restaurant_id"), sid);
  }

  public Object open(Actor a, UUID rid, UUID tid) {
    access.staff(a, rid);
    db.one("SELECT id FROM restaurant WHERE id=? FOR SHARE", rid);
    var t =
        db.one("SELECT * FROM dining_table WHERE restaurant_id=? AND id=? FOR UPDATE", rid, tid);
    if (!Db.bool(t, "pilot_enabled"))
      throw Problem.conflict("Enable this table before opening a session.");
    if (db.number("SELECT count(*) FROM table_session WHERE table_id=? AND status='OPEN'", tid) > 0)
      throw Problem.conflict("This table already has an open session.");
    UUID sid = UUID.randomUUID();
    String token = qr();
    Instant expires = Instant.now().plus(24, ChronoUnit.HOURS);
    db.update(
        "INSERT INTO table_session(id,restaurant_id,table_id,qr_hash,qr_expires_at)"
            + " VALUES(?,?,?,?,?)",
        sid,
        rid,
        tid,
        Commands.hash(token),
        Timestamp.from(expires));
    var s = db.one("SELECT * FROM table_session WHERE id=?", sid);
    pos.track(rid, sid);
    event(a, s, "SESSION_OPENED", Map.of("tableId", tid));
    return Map.of(
        "sessionId", sid, "joinToken", token, "expiresAt", expires.toString(), "revision", 1);
  }

  public Object rotate(Actor a, UUID sid, long revision) {
    var s = lock(a, sid, revision);
    access.staff(a, Db.id(s, "restaurant_id"));
    String token = qr();
    Instant expires = Instant.now().plus(24, ChronoUnit.HOURS);
    db.update(
        "UPDATE table_session SET qr_hash=?,qr_expires_at=? WHERE id=?",
        Commands.hash(token),
        Timestamp.from(expires),
        sid);
    event(a, s, "QR_ROTATED", Map.of());
    return Map.of("sessionId", sid, "joinToken", token, "expiresAt", expires.toString());
  }

  public Object inspect(String token) {
    var s = findJoin(token, false);
    UUID rid = Db.id(s, "restaurant_id");
    var t =
        db.one(
            "SELECT t.label,b.name AS branch_name,r.name AS"
                + " restaurant_name,t.max_guests,b.languages,b.default_language,b.operating_mode"
                + " FROM dining_table t JOIN branch b ON b.id=t.branch_id JOIN restaurant r ON"
                + " r.id=t.restaurant_id WHERE t.id=?",
            Db.id(s, "table_id"));
    metrics.scan(rid);
    return Map.of("sessionId", s.get("id"), "table", t, "menu", catalog.menu(rid));
  }

  public Object join(String token, String name) {
    var first = findJoin(token, false);
    db.one("SELECT id FROM dining_table WHERE id=? FOR UPDATE", Db.id(first, "table_id"));
    var s = findJoin(token, true);
    return joinSession(s, name);
  }

  public Object joinSession(Map<String, Object> s, String name) {
    UUID sid = Db.id(s, "id"), rid = Db.id(s, "restaurant_id");
    var t = db.one("SELECT * FROM dining_table WHERE id=?", Db.id(s, "table_id"));
    if (!Db.bool(t, "pilot_enabled")) throw Problem.conflict("This table is currently disabled.");
    if (db.number("SELECT count(*) FROM guest WHERE session_id=? AND active=true", sid)
        >= Db.amount(t, "max_guests"))
      throw Problem.conflict("This table has reached its guest limit.");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO guest(id,restaurant_id,session_id,nickname) VALUES(?,?,?,?)",
        id,
        rid,
        sid,
        name.trim());
    event(
        new Actor(id, "GUEST", 0),
        s,
        "GUEST_JOINED",
        Map.of("guestId", id));
    Map<String, Object> result = new LinkedHashMap<>(auth.token(id, "GUEST", 0));
    result.put("sessionId", sid);
    result.put("nickname", name.trim());
    return result;
  }

  private Map<String, Object> findJoin(String token, boolean lock) {
    if (token == null || token.length() < 32 || token.length() > 100) throw Problem.missing();
    var s =
        db.optional(
                "SELECT * FROM table_session WHERE qr_hash=? AND status='OPEN' AND"
                    + " qr_expires_at>now()"
                    + (lock ? " FOR UPDATE" : ""),
                Commands.hash(token))
            .orElseThrow(
                () ->
                    new Problem(
                        410,
                        "JOIN_LINK_EXPIRED",
                        "This table link has expired or been replaced. Ask the waiter for the"
                            + " current QR."));
    return s;
  }

  public void validateJoin(String token) {
    var first = findJoin(token, false);
    var t =
        db.one(
            "SELECT pilot_enabled FROM dining_table WHERE id=? FOR UPDATE",
            Db.id(first, "table_id"));
    findJoin(token, true);
    if (!Db.bool(t, "pilot_enabled")) throw Problem.conflict("This table is currently disabled.");
  }

  @SuppressWarnings("unchecked")
  public Object validateJoinResult(Object result) {
    var row = (Map<String, Object>) result;
    UUID id = UUID.fromString(row.get("actorId").toString());
    if (db.number("SELECT count(*) FROM guest WHERE id=? AND active AND token_version=0", id) != 1)
      throw new Problem(
          401, "TOKEN_REVOKED", "This guest was signed out. Ask staff for help joining again.");
    return result;
  }

  public Object help(Actor a, UUID sid, long revision, String reason) {
    var s = lock(a, sid, revision);
    access.guest(a, sid);
    if (db.number(
            "SELECT count(*) FROM assistance_request WHERE guest_id=? AND status='OPEN'", a.id())
        >= 3) throw Problem.conflict("You already have three open requests.");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO assistance_request(id,restaurant_id,session_id,guest_id,reason)"
            + " VALUES(?,?,?,?,?)",
        id,
        Db.id(s, "restaurant_id"),
        sid,
        a.id(),
        reason.trim());
    event(a, s, "HELP_REQUESTED", Map.of("requestId", id));
    return Map.of("id", id);
  }

  public Object helpDone(Actor a, UUID sid, UUID hid, long revision) {
    var s = lock(a, sid, revision);
    access.staff(a, Db.id(s, "restaurant_id"));
    if (db.update(
            "UPDATE assistance_request SET status='DONE' WHERE session_id=? AND id=? AND"
                + " status='OPEN'",
            sid,
            hid)
        != 1) throw Problem.conflict("This request is already resolved or unavailable.");
    event(a, s, "HELP_COMPLETED", Map.of("requestId", hid));
    return Map.of("id", hid);
  }

  public Object close(Actor a, UUID sid, long revision) {
    var s = lock(a, sid, revision);
    access.staff(a, Db.id(s, "restaurant_id"));
    long bill =
        db.number("SELECT coalesce(sum(amount_bani),0) FROM bill_entry WHERE session_id=?", sid);
    long paid =
        db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM settlement_entry WHERE session_id=?", sid);
    if (bill != paid) throw Problem.conflict("Settle the outstanding bill before closing.");
    if (db.number(
            "SELECT count(*) FROM order_item WHERE session_id=? AND status"
                + " IN('SUBMITTED','ACCEPTED','PREPARING','READY')",
            sid)
        > 0) throw Problem.conflict("Resolve all outstanding orders before closing.");
    if (db.number(
                "SELECT count(*) FROM allocation_proposal WHERE session_id=? AND status='PENDING'",
                sid)
            > 0
        || db.number(
                "SELECT count(*) FROM assistance_request WHERE session_id=? AND status='OPEN'", sid)
            > 0
        || db.number(
                "SELECT count(*) FROM checkout_reservation WHERE session_id=? AND"
                    + " (status='PROCESSING' OR (status='HELD' AND expires_at>now()))",
                sid)
            > 0)
      throw Problem.conflict(
          "Resolve requests, split proposals and checkout holds before closing.");
    if (db.number(
            "SELECT count(*) FROM payment_refund WHERE session_id=? AND status='PENDING'", sid)
        > 0) throw Problem.conflict("Resolve pending refunds before closing.");
    db.update(
        "UPDATE table_session SET status='CLOSED',closed_at=now(),qr_hash=? WHERE id=?",
        Commands.hash(qr()),
        sid);
    event(a, s, "SESSION_CLOSED", Map.of());
    return Map.of("closed", true);
  }

  public Object revokeGuest(Actor a, UUID sid, UUID gid, long revision) {
    var s = lock(a, sid, revision);
    access.staff(a, Db.id(s, "restaurant_id"));
    db.one("SELECT id FROM guest WHERE id=? AND session_id=?", gid, sid);
    if (db.number(
                "SELECT count(*) FROM order_item WHERE session_id=? AND status NOT"
                    + " IN('CANCELLED','REJECTED') AND (ordered_by=? OR served_to=?)",
                sid,
                gid,
                gid)
            > 0
        || db.number(
                "SELECT coalesce(sum(amount_bani),0) FROM allocation_entry WHERE session_id=? AND"
                    + " guest_id=?",
                sid,
                gid)
            != 0
        || db.number(
                "SELECT count(*) FROM proposal_vote v JOIN allocation_proposal p ON"
                    + " p.id=v.proposal_id WHERE v.guest_id=? AND p.status='PENDING'",
                gid)
            > 0)
      throw Problem.conflict("Resolve this guest's orders and allocations before removing them.");
    db.update("UPDATE guest SET active=false,token_version=token_version+1 WHERE id=?", gid);
    event(a, s, "GUEST_REVOKED", Map.of("guestId", gid));
    return Map.of("revoked", true);
  }

  private String qr() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
