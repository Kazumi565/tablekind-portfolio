package md.tablekind.payments;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import java.util.function.Supplier;
import md.tablekind.auth.Actor;
import md.tablekind.common.Commands;
import md.tablekind.session.SessionController.Revision;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sid}")
public class PaymentController {
  private final Payments payments;
  private final Commands commands;

  public PaymentController(Payments payments, Commands commands) {
    this.payments = payments;
    this.commands = commands;
  }

  private Object command(
      String scope, UUID key, String operation, Object body, Supplier<Object> change) {
    // Profile capability must also be checked before returning a saved TEST receipt.
    payments.requireTestPayments();
    return commands.run(scope, key, operation, body, change);
  }

  public record Start(
      @Min(0) long revision,
      @NotNull @Pattern(regexp = "SELF|GUESTS|REMAINDER") String target,
      @NotNull @Size(max = 20) List<@NotNull UUID> guestIds,
      UUID payerId,
      @Min(1) @Max(1000000000) Long amountBani,
      @NotNull @Pattern(regexp = "CARD|MIA|CASH|TERMINAL") String method,
      @Min(0) @Max(100000000) long tipBani) {}

  public record Confirm(
      @Min(0) long revision,
      @Min(1) @Max(2000000000) Long receivedBani,
      @Size(max = 120) String reference,
      boolean collected) {}

  public record Refund(
      @Min(0) long revision,
      @Min(0) @Max(1000000000) long amountBani,
      @Min(0) @Max(100000000) long tipBani,
      @NotNull @Pattern(regexp = "REDUCE_BILL|RETURN_PAYMENT") String mode,
      @NotBlank @Size(max = 400) String reason) {}

  public record RefundConfirm(
      @Min(0) long revision, @Size(max = 120) String reference, boolean returned) {}

  @PostMapping("/payments")
  public Object start(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Start r) {
    var a = Actor.from(jwt);
    return command(a.scope(), key, "payment-start:" + sid, r, () -> payments.start(a, sid, r));
  }

  @PostMapping("/payments/{id}/confirm")
  public Object confirm(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Confirm r) {
    var a = Actor.from(jwt);
    return command(
        a.scope(), key, "payment-confirm:" + sid + id, r, () -> payments.confirm(a, sid, id, r));
  }

  @PostMapping("/payments/{id}/cancel")
  public Object cancel(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return command(
        a.scope(),
        key,
        "payment-cancel:" + sid + id,
        r,
        () -> payments.cancel(a, sid, id, r.revision()));
  }

  @PostMapping("/payments/{id}/reconcile")
  public Object reconcile(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return command(
        a.scope(),
        key,
        "payment-reconcile:" + sid + id,
        r,
        () -> payments.reconcile(a, sid, id, r.revision()));
  }

  @PostMapping("/payments/{id}/refunds")
  public Object refund(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Refund r) {
    var a = Actor.from(jwt);
    return command(
        a.scope(), key, "refund-start:" + sid + id, r, () -> payments.refund(a, sid, id, r));
  }

  @PostMapping("/refunds/{id}/confirm")
  public Object refundConfirm(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody RefundConfirm r) {
    var a = Actor.from(jwt);
    return command(
        a.scope(),
        key,
        "refund-confirm:" + sid + id,
        r,
        () -> payments.confirmRefund(a, sid, id, r));
  }

  @PostMapping("/refunds/{id}/cancel")
  public Object refundCancel(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return command(
        a.scope(),
        key,
        "refund-cancel:" + sid + id,
        r,
        () -> payments.cancelRefund(a, sid, id, r.revision()));
  }

  @GetMapping("/payments/{id}/confirmation")
  public Object confirmation(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid, @PathVariable UUID id) {
    return payments.confirmation(Actor.from(jwt), sid, id);
  }

  @GetMapping("/payments/reconciliation")
  public Object report(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid) {
    return payments.report(Actor.from(jwt), sid);
  }
}
