package md.tablekind.session;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.restaurant.CatalogService;
import md.tablekind.restaurant.PilotMetrics;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Reusable table locator. It never opens a session and never grants staff privileges. */
@RestController
@RequestMapping("/api")
public class TableLinks {
  private final Db db;
  private final Access access;
  private final Commands commands;
  private final Sessions sessions;
  private final SecretKeySpec key;
  private final CatalogService catalog;
  private final PilotMetrics metrics;

  public TableLinks(
      Db db,
      Access access,
      Commands commands,
      Sessions sessions,
      SecretKeySpec key,
      CatalogService catalog, PilotMetrics metrics) {
    this.db = db;
    this.access = access;
    this.commands = commands;
    this.sessions = sessions;
    this.key = key;
    this.catalog = catalog;
    this.metrics = metrics;
  }

  private String sign(String value) {
    try {
      var mac = Mac.getInstance("HmacSHA256");
      mac.init(key);
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(mac.doFinal(("table-link:v1:" + value).getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  private Object link(Map<String, Object> table) {
    String base = table.get("id") + "." + table.get("qr_version");
    return Map.of(
        "tableId", table.get("id"), "label", table.get("label"), "token", base + "." + sign(base));
  }

  @GetMapping("/restaurants/{rid}/tables/{tid}/link")
  public Object current(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid, @PathVariable UUID tid) {
    access.manager(Actor.from(jwt), rid);
    var table =
        db.one(
            "SELECT id,label,qr_version FROM dining_table WHERE restaurant_id=? AND id=?",
            rid,
            tid);
    return table.get("qr_version") == null ? Map.of("configured", false) : link(table);
  }

  @PostMapping("/restaurants/{rid}/tables/{tid}/link")
  public Object rotate(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @PathVariable UUID tid,
      @RequestHeader("Idempotency-Key") UUID commandKey) {
    Actor a = Actor.from(jwt);
    access.manager(a, rid);
    return commands.run(
        a.scope(),
        commandKey,
        "printed-link:" + rid + tid,
        Map.of(),
        () -> {
          var table =
              db.one(
                  "UPDATE dining_table SET qr_version=? WHERE restaurant_id=? AND id=? RETURNING"
                      + " id,label,qr_version",
                  UUID.randomUUID(),
                  rid,
                  tid);
          catalog.audit(a, rid, "TABLE_LINK_ROTATED", Map.of("tableId", tid));
          return link(table);
        });
  }

  private Map<String, Object> table(String token, boolean lock) {
    String[] parts = token.split("\\.");
    if (parts.length != 3
        || token.length() > 160
        || !MessageDigest.isEqual(
            sign(parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII),
            parts[2].getBytes(StandardCharsets.US_ASCII))) throw expired();
    return db.optional(
            "SELECT * FROM dining_table WHERE id=? AND qr_version=? AND pilot_enabled"
                + (lock ? " FOR UPDATE" : ""),
            UUID.fromString(parts[0]),
            UUID.fromString(parts[1]))
        .orElseThrow(TableLinks::expired);
  }

  private static Problem expired() {
    return new Problem(
        410,
        "TABLE_LINK_EXPIRED",
        "This table link was replaced or the table is disabled. Ask staff for the current QR.");
  }

  private Map<String, Object> active(UUID tid, boolean lock) {
    return db.optional(
            "SELECT * FROM table_session WHERE table_id=? AND status='OPEN' AND qr_expires_at>now()"
                + (lock ? " FOR UPDATE" : ""),
            tid)
        .orElseThrow(
            () ->
                new Problem(
                    409, "TABLE_NOT_OPEN", "Ask the waiter to open this table before joining."));
  }

  @GetMapping("/table-links/{token}")
  @Transactional
  public Object inspect(@PathVariable String token) {
    var t = table(token, false);
    var s = active(Db.id(t, "id"), false);
    metrics.scan(Db.id(t, "restaurant_id"));
    return Map.of(
        "sessionId",
        s.get("id"),
        "table",
        db.one(
            "SELECT t.label,b.name AS branch_name,r.name AS"
                + " restaurant_name,b.languages,b.default_language,b.operating_mode FROM"
                + " dining_table t JOIN branch b ON b.id=t.branch_id JOIN restaurant r ON"
                + " r.id=t.restaurant_id WHERE t.id=?",
            Db.id(t, "id")));
  }

  public record Join(
      @NotBlank @Size(max = 160) String token,
      @NotNull UUID sessionId,
      @NotBlank @Size(max = 40) String nickname) {}

  @PostMapping("/table-links/join")
  @Transactional
  public Object join(
      @RequestHeader("Idempotency-Key") UUID commandKey, @Valid @RequestBody Join r) {
    var t = table(r.token(), true);
    var s = active(Db.id(t, "id"), true);
    if (!Db.id(s, "id").equals(r.sessionId()))
      throw Problem.conflict(
          "A new group has opened this table. Scan again and confirm the table.");
    return sessions.validateJoinResult(
        commands.run(
            "PRINTED-JOIN:" + Commands.hash(r.token()),
            commandKey,
            "join:" + r.sessionId(),
            r,
            () -> sessions.joinSession(s, r.nickname())));
  }
}
