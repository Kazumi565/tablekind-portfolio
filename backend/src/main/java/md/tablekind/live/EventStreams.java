package md.tablekind.live;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Notifications invalidate client caches. Reconnection always sends a fresh invalidation. */
@RestController
@RequestMapping("/api")
public class EventStreams {
  private final Db db;
  private final Access access;
  private final List<Client> clients = new CopyOnWriteArrayList<>();

  private static class Client {
    final Actor actor;
    final UUID restaurant;
    final UUID session;
    final Instant expires;
    final SseEmitter emitter;
    long sequence = -1;
    int ticks = 0;

    Client(Actor a, UUID r, UUID s, Instant e, SseEmitter emitter) {
      actor = a;
      restaurant = r;
      session = s;
      expires = e;
      this.emitter = emitter;
    }
  }

  public EventStreams(Db db, Access access) {
    this.db = db;
    this.access = access;
  }

  @GetMapping(value = "/sessions/{sid}/events", produces = "text/event-stream")
  public SseEmitter session(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid) {
    Actor a = Actor.from(jwt);
    var s = access.session(a, sid);
    return connect(a, Db.id(s, "restaurant_id"), sid, jwt.getExpiresAt());
  }

  @GetMapping(value = "/restaurants/{rid}/events", produces = "text/event-stream")
  public SseEmitter restaurant(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid) {
    Actor a = Actor.from(jwt);
    access.staff(a, rid);
    return connect(a, rid, null, jwt.getExpiresAt());
  }

  private SseEmitter connect(Actor a, UUID rid, UUID sid, Instant expiry) {
    if (clients.size() >= 256)
      throw new Problem(
          503, "STREAM_LIMIT", "Too many live connections. Close unused tabs and reconnect.");
    var emitter = new SseEmitter(60_000L);
    var c = new Client(a, rid, sid, expiry, emitter);
    clients.add(c);
    emitter.onCompletion(() -> clients.remove(c));
    emitter.onTimeout(
        () -> {
          clients.remove(c);
          emitter.complete();
        });
    emitter.onError(e -> clients.remove(c));
    return emitter;
  }

  @Scheduled(fixedDelay = 1000)
  void tick() {
    for (var c : clients) {
      try {
        if (c.expires == null || !c.expires.isAfter(Instant.now())) throw Problem.forbidden();
        if (c.session == null) access.staff(c.actor, c.restaurant);
        else access.session(c.actor, c.session);
        // COUNT sees even a late commit with a lower bigserial ID. MAX(id) can miss it.
        long version =
            c.session == null
                ? db.number("SELECT count(*) FROM audit_event WHERE restaurant_id=?", c.restaurant)
                : db.number(
                    "SELECT count(*) FROM audit_event WHERE restaurant_id=? AND (session_id=? OR"
                        + " session_id IS NULL)",
                    c.restaurant,
                    c.session);
        if (version != c.sequence) {
          c.emitter.send(SseEmitter.event().name("changed").data(Map.of("sequence", version)));
          c.sequence = version;
        } else if (++c.ticks % 15 == 0) c.emitter.send(SseEmitter.event().comment("keepalive"));
      } catch (Exception ex) {
        clients.remove(c);
        c.emitter.complete();
      }
    }
  }
}
