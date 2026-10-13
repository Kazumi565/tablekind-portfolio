package md.tablekind.ai;

import java.util.UUID;
import md.tablekind.auth.Access;
import md.tablekind.auth.Actor;
import md.tablekind.common.Db;
import org.springframework.stereotype.Service;

@Service
public class AiAvailability {
  public enum Status {
    AVAILABLE,
    DISABLED,
    UNCONFIGURED,
    ALLOWANCE_REACHED,
    DINER_LIMIT_REACHED
  }

  public record Availability(Status status) {}

  private final Access access;
  private final AiSettings settings;
  private final Db db;

  public AiAvailability(Access access, AiSettings settings, Db db) {
    this.access = access;
    this.settings = settings;
    this.db = db;
  }

  public Availability status(Actor actor, UUID session) {
    access.guest(actor, session);
    if (!settings.enabled()) return new Availability(Status.DISABLED);
    if (settings.apiKey().isBlank()) return new Availability(Status.UNCONFIGURED);
    if (settings.maxCalls() <= 0
        || db.number("SELECT count(*) FROM ai_usage") >= settings.maxCalls())
      return new Availability(Status.ALLOWANCE_REACHED);
    if (db.number(
            "SELECT count(*) FROM ai_usage WHERE guest_id=? AND created_at>now()-interval '1 hour'",
            actor.id())
        >= 20) return new Availability(Status.DINER_LIMIT_REACHED);
    return new Availability(Status.AVAILABLE);
  }
}
