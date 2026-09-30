package md.tablekind.session;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.Commands;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SessionController {
  private final Sessions sessions;
  private final SessionView view;
  private final Commands commands;

  public SessionController(Sessions sessions, SessionView view, Commands commands) {
    this.sessions = sessions;
    this.view = view;
    this.commands = commands;
  }

  public record Revision(@Min(0) long revision) {}

  public record Join(
      @NotBlank @Size(min = 32, max = 100) String token,
      @NotBlank @Size(max = 40) String nickname) {}

  public record Help(@Min(0) long revision, @NotBlank @Size(max = 200) String reason) {}

  @GetMapping("/join/{token}")
  public Object inspect(@PathVariable String token) {
    return sessions.inspect(token);
  }

  @PostMapping("/join")
  @org.springframework.transaction.annotation.Transactional
  public Object join(@RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody Join r) {
    sessions.validateJoin(r.token());
    return sessions.validateJoinResult(
        commands.run(
            "JOIN:" + Commands.hash(r.token()),
            key,
            "join",
            r,
            () -> sessions.join(r.token(), r.nickname())));
  }

  @PostMapping("/restaurants/{rid}/tables/{tid}/sessions")
  public Object open(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID tid) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "open:" + rid + tid, Map.of(), () -> sessions.open(a, rid, tid));
  }

  @GetMapping("/sessions/{sid}")
  public Object get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid) {
    return view.state(Actor.from(jwt), sid);
  }

  @PostMapping("/sessions/{sid}/qr")
  public Object rotate(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID sid,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "qr:" + sid, r, () -> sessions.rotate(a, sid, r.revision()));
  }

  @PostMapping("/sessions/{sid}/close")
  public Object close(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID sid,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "close:" + sid, r, () -> sessions.close(a, sid, r.revision()));
  }

  @PostMapping("/sessions/{sid}/help")
  public Object help(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID sid,
      @Valid @RequestBody Help r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "help:" + sid, r, () -> sessions.help(a, sid, r.revision(), r.reason()));
  }

  @PostMapping("/sessions/{sid}/help/{hid}/complete")
  public Object done(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID sid,
      @PathVariable UUID hid,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "help-done:" + sid + hid,
        r,
        () -> sessions.helpDone(a, sid, hid, r.revision()));
  }

  @PostMapping("/sessions/{sid}/guests/{gid}/revoke")
  public Object revoke(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID sid,
      @PathVariable UUID gid,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "revoke:" + sid + gid,
        r,
        () -> sessions.revokeGuest(a, sid, gid, r.revision()));
  }
}
