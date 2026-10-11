package md.tablekind.paypal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import md.tablekind.auth.Actor;
import md.tablekind.common.Commands;
import md.tablekind.session.SessionController.Revision;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sid}/paypal")
public class PayPalController {
  private final PayPalPayments paypal;
  private final Commands commands;

  public PayPalController(PayPalPayments paypal, Commands commands) {
    this.paypal = paypal;
    this.commands = commands;
  }

  public record Start(@Min(0) long revision, @Min(0) @Max(100000000) long tipMinor) {}

  @PostMapping
  public Object start(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Start r) {
    var a = Actor.from(jwt);
    paypal.authorize(a, sid, null);
    return commands.run(
        a.scope(),
        key,
        "paypal-start:" + sid,
        r,
        () -> paypal.start(a, sid, r.revision(), r.tipMinor()));
  }

  @GetMapping("/{id}")
  public Object status(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid, @PathVariable UUID id) {
    return paypal.view(Actor.from(jwt), sid, id);
  }

  @PostMapping("/{id}/{operation:approve|cancel}")
  public Object change(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @PathVariable String operation,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    paypal.authorize(a, sid, id);
    return commands.run(
        a.scope(),
        key,
        "paypal-" + operation + ":" + sid + ":" + id,
        r,
        () -> operation.equals("approve") ? paypal.capture(a, sid, id) : paypal.cancel(a, sid, id));
  }
}
