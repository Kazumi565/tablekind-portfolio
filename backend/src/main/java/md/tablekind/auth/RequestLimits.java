package md.tablekind.auth;

import java.time.Instant;
import md.tablekind.common.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Database-backed fixed windows. Never trust a client-supplied forwarding header. */
@Service
public class RequestLimits {
  private final Db db;
  private final boolean enabled;

  public RequestLimits(Db db, @Value("${tablekind.security.rate-limits:true}") boolean enabled) {
    this.db = db;
    this.enabled = enabled;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = Problem.class)
  public void check(String identity, int maximum, int seconds) {
    if (!enabled) return;
    long window = Instant.now().getEpochSecond() / seconds;
    var row =
        db.one(
            "INSERT INTO request_limit(bucket,window_start,hits,expires_at) VALUES(?,?,1,now() + (?"
                + " * interval '1 second')) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN"
                + " request_limit.window_start=excluded.window_start THEN request_limit.hits+1 ELSE"
                + " 1 END, window_start=excluded.window_start,expires_at=excluded.expires_at"
                + " RETURNING hits",
            Commands.hash(identity),
            window,
            seconds * 2);
    db.update("DELETE FROM request_limit WHERE expires_at<now()");
    if (Db.amount(row, "hits") > maximum)
      throw new Problem(
          429, "RATE_LIMITED", "Too many attempts. Wait a minute before trying again.");
  }
}
