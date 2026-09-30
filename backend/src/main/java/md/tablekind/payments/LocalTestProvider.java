package md.tablekind.payments;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import md.tablekind.common.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Database-backed simulator; never processes real money or stores card data. */
@Component
@Profile({"local", "demo"})
public class LocalTestProvider implements PaymentProvider {
  private final Db db;
  private final ObjectMapper json;
  private final byte[] secret;

  public LocalTestProvider(
      Db db, ObjectMapper json, @Value("${tablekind.test-webhook-secret}") String secret) {
    this.db = db;
    this.json = json;
    this.secret = secret.getBytes(StandardCharsets.UTF_8);
    if (this.secret.length < 32)
      throw new IllegalStateException("Test webhook secret must be at least 32 bytes.");
  }

  public String name() {
    return "LOCAL_TEST";
  }

  public boolean testMode() {
    return true;
  }

  public void create(UUID id, UUID rid, String kind, long amount) {
    db.update(
        "INSERT INTO test_provider_intent(id,restaurant_id,kind,amount_bani,currency)"
            + " VALUES(?,?,?,?,'MDL')",
        id,
        rid,
        kind,
        amount);
  }

  public Intent lookup(UUID id) {
    var r = db.one("SELECT * FROM test_provider_intent WHERE id=?", id);
    return new Intent(
        id,
        Db.id(r, "restaurant_id"),
        Db.text(r, "kind"),
        Db.amount(r, "amount_bani"),
        Db.text(r, "currency"),
        Db.text(r, "status"));
  }

  public Intent cancel(UUID id) {
    db.update(
        "UPDATE test_provider_intent SET status='CANCELLED' WHERE id=? AND status='PENDING'", id);
    return lookup(id);
  }

  public Intent resolve(UUID id, String status) {
    if (!Set.of("SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED").contains(status))
      throw Problem.bad("Choose a terminal test outcome.");
    var previous = lookup(id);
    if (!previous.status().equals("PENDING") && !previous.status().equals(status))
      throw Problem.conflict(
          "The provider already has a final outcome. Reconcile it; do not overwrite it.");
    db.update(
        "UPDATE test_provider_intent SET status=? WHERE id=? AND status='PENDING'", status, id);
    return lookup(id);
  }

  public record Envelope(byte[] body, String timestamp, String signature) {}

  public Envelope notification(UUID id) {
    var i = lookup(id);
    var e =
        new Event(
            UUID.randomUUID(),
            id,
            i.restaurantId(),
            i.kind(),
            i.amountBani(),
            i.currency(),
            i.status());
    byte[] body = db.json(e).getBytes(StandardCharsets.UTF_8);
    String timestamp = Long.toString(Instant.now().getEpochSecond());
    return new Envelope(body, timestamp, sign(body, timestamp));
  }

  public String sign(byte[] body, String timestamp) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(mac.doFinal(body));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Event verify(byte[] body, String timestamp, String signature) {
    try {
      long sent = Long.parseLong(timestamp), now = Instant.now().getEpochSecond();
      if (sent < now - 300
          || sent > now + 300
          || body.length > 8192
          || signature.length() != 64
          || !MessageDigest.isEqual(
              HexFormat.of().parseHex(signature), HexFormat.of().parseHex(sign(body, timestamp))))
        throw new IllegalArgumentException();
      Event e = json.readValue(body, Event.class);
      if (e.eventId() == null
          || e.intentId() == null
          || e.restaurantId() == null
          || !Set.of("PAYMENT", "REFUND").contains(e.kind())
          || !"MDL".equals(e.currency())
          || e.amountBani() < 1
          || !Set.of("PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED").contains(e.status()))
        throw new IllegalArgumentException();
      return e;
    } catch (Exception e) {
      throw new Problem(401, "INVALID_WEBHOOK", "Invalid or stale provider notification.");
    }
  }
}
