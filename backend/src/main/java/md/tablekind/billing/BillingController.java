package md.tablekind.billing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.Actor;
import md.tablekind.common.Commands;
import md.tablekind.session.SessionController.Revision;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sid}")
public class BillingController {
  private final Allocations allocations;
  private final Commands commands;

  public BillingController(Allocations allocations, Commands commands) {
    this.allocations = allocations;
    this.commands = commands;
  }

  public record Share(@NotNull UUID guestId, @Min(0) @Max(1000000000) long value) {}

  public record Split(
      @Min(0) long revision,
      @NotNull @Pattern(regexp = "EQUAL|PROPORTION|QUANTITY|AMOUNTS") String mode,
      @NotEmpty @Size(max = 20) List<@Valid Share> shares,
      @Min(1) @Max(1000000) Long totalUnits,
      @NotBlank @Size(max = 400) String reason) {}

  public record Transfer(
      @Min(0) long revision, @NotNull UUID guestId, @NotBlank @Size(max = 400) String reason) {}

  public record Vote(@Min(0) long revision, boolean accept) {}

  public record TableSplit(
      @Min(0) long revision, @NotEmpty @Size(max = 20) List<@NotNull UUID> guestIds) {}

  public record Adjustment(
      @Min(0) long revision,
      UUID itemId,
      @NotNull @Pattern(regexp = "DISCOUNT|SERVICE_CHARGE|TAX|CORRECTION") String kind,
      @Min(-1000000000) @Max(1000000000) Long amountBani,
      @Min(0) @Max(10000) Integer basisPoints,
      @NotBlank @Size(max = 400) String reason) {}

  public record Checkout(
      @Min(0) long revision,
      @NotNull @Pattern(regexp = "SELF|GUESTS|REMAINDER") String target,
      @NotNull @Size(max = 20) List<@NotNull UUID> guestIds,
      UUID payerId,
      @Min(1) @Max(1000000000) Long amountBani) {}

  @PostMapping("/items/{item}/split")
  public Object split(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID item,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Split r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "split:" + sid + item, r, () -> allocations.split(a, sid, item, r));
  }

  @PostMapping("/items/{item}/transfer")
  public Object transfer(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID item,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Transfer r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "transfer:" + sid + item, r, () -> allocations.transfer(a, sid, item, r));
  }

  @PostMapping("/items/{item}/takeover")
  public Object takeover(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID item,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "takeover:" + sid + item,
        r,
        () -> allocations.takeover(a, sid, item, r.revision()));
  }

  @PostMapping("/split-equally")
  public Object equal(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody TableSplit r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "table-equal:" + sid, r, () -> allocations.tableEqual(a, sid, r));
  }

  @PostMapping("/proposals/{pid}/vote")
  public Object vote(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID pid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Vote r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "vote:" + sid + pid, r, () -> allocations.vote(a, sid, pid, r));
  }

  @PostMapping("/proposals/{pid}/withdraw")
  public Object withdraw(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID pid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "withdraw:" + sid + pid,
        r,
        () -> allocations.withdraw(a, sid, pid, r.revision()));
  }

  @PostMapping("/adjustments")
  public Object adjustment(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Adjustment r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "adjust:" + sid, r, () -> allocations.adjustment(a, sid, r));
  }

  @PostMapping("/checkout/quote")
  public Object quote(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Checkout r) {
    var a = Actor.from(jwt);
    return commands.run(a.scope(), key, "quote:" + sid, r, () -> allocations.quote(a, sid, r));
  }

  @PostMapping("/checkout/reservations")
  public Object reserve(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Checkout r) {
    var a = Actor.from(jwt);
    return commands.run(a.scope(), key, "reserve:" + sid, r, () -> allocations.reserve(a, sid, r));
  }

  @PostMapping("/checkout/reservations/{id}/release")
  public Object release(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "release:" + sid + id,
        r,
        () -> allocations.release(a, sid, id, r.revision()));
  }
}
