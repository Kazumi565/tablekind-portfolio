package md.tablekind.payments;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import md.tablekind.auth.Actor;
import md.tablekind.common.Commands;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile({"local", "demo"})
public class LocalPaymentController {
  private final Payments payments;
  private final LocalTestProvider provider;
  private final PaymentEvents events;
  private final Commands commands;

  public LocalPaymentController(
      Payments payments, LocalTestProvider provider, PaymentEvents events, Commands commands) {
    this.payments = payments;
    this.provider = provider;
    this.events = events;
    this.commands = commands;
  }

  public record Result(
      @Min(0) long revision,
      @NotNull @Pattern(regexp = "PAYMENT|REFUND") String kind,
      @NotNull @Pattern(regexp = "SUCCEEDED|FAILED|CANCELLED|EXPIRED") String outcome,
      boolean deliver) {}

  @PostMapping("/api/sessions/{sid}/payments/{id}/test-result")
  public Object resolve(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Result r) {
    var a = Actor.from(jwt);
    if ("REFUND".equals(r.kind())) payments.requireManager(a, sid);
    return commands.run(
        a.scope(),
        key,
        "test-provider:" + sid + id,
        r,
        () ->
            payments.testResult(
                a, sid, id, r.revision(), r.kind(), r.outcome(), r.deliver(), provider, events));
  }

  @PostMapping("/api/payment-webhooks/local-test")
  public Object webhook(
      @RequestBody byte[] body,
      @RequestHeader("X-Payment-Timestamp") String timestamp,
      @RequestHeader("X-Payment-Signature") String signature) {
    return events.receive(body, timestamp, signature);
  }
}
