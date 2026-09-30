package md.tablekind.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Commands {
  private final Db db;

  public Commands(Db db) {
    this.db = db;
  }

  /**
   * Read a completed command before doing an external, read-only fetch. Never authorizes access.
   */
  public Optional<Object> replay(String actorScope, UUID key, String operation, Object request) {
    if (key == null) throw Problem.bad("An Idempotency-Key UUID is required.");
    var prior =
        db.optional(
            "SELECT fingerprint,response FROM command_receipt WHERE actor_scope=? AND"
                + " command_key=?",
            actorScope,
            key);
    if (prior.isEmpty()) return Optional.empty();
    if (!hash(operation + "\n" + db.json(request)).equals(prior.get().get("fingerprint")))
      throw Problem.conflict("This idempotency key was already used for a different request.");
    return Optional.of(prior.get().get("response"));
  }

  @Transactional
  public Object run(
      String actorScope, UUID key, String operation, Object request, Supplier<Object> action) {
    if (key == null) throw Problem.bad("An Idempotency-Key UUID is required.");
    String fingerprint = hash(operation + "\n" + db.json(request));
    // Transaction lock also serializes the very first use of an idempotency key.
    db.jdbc.execute(
        (org.springframework.jdbc.core.ConnectionCallback<Void>)
            c -> {
              try (var s =
                  c.prepareStatement("SELECT pg_advisory_xact_lock(hashtextextended(?,0))")) {
                s.setString(1, actorScope + ":" + key);
                s.execute();
                return null;
              }
            });
    var prior =
        db.optional(
            "SELECT fingerprint,response FROM command_receipt WHERE actor_scope=? AND"
                + " command_key=?",
            actorScope,
            key);
    if (prior.isPresent()) {
      if (!fingerprint.equals(prior.get().get("fingerprint")))
        throw Problem.conflict("This idempotency key was already used for a different request.");
      return prior.get().get("response");
    }
    Object response = action.get();
    db.update(
        "INSERT INTO command_receipt(actor_scope,command_key,fingerprint,response)"
            + " VALUES(?,?,?,?::jsonb)",
        actorScope,
        key,
        fingerprint,
        db.json(response));
    return response;
  }

  public static String hash(String input) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
