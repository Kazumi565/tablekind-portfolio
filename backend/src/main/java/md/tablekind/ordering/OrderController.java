package md.tablekind.ordering;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.Actor;
import md.tablekind.common.Commands;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sid}/orders")
public class OrderController {
  private final Orders orders;
  private final Commands commands;

  public OrderController(Orders orders, Commands commands) {
    this.orders = orders;
    this.commands = commands;
  }

  public record Submit(
      @Min(0) long revision,
      @NotNull UUID productId,
      @Min(1) int productVersion,
      @Min(1) @Max(20) int quantity,
      @NotNull @Size(max = 100) List<@NotNull UUID> optionIds,
      UUID orderedBy,
      UUID servedTo,
      @NotNull @Size(max = 400) String note) {}

  public record Status(
      @Min(0) long revision,
      @NotNull @Pattern(regexp = "ACCEPTED|PREPARING|READY|SERVED|REJECTED|CANCELLED")
          String status,
      @NotNull @Size(max = 400) String reason) {}

  @PostMapping
  public Object submit(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Submit r) {
    var a = Actor.from(jwt);
    return commands.run(a.scope(), key, "order:" + sid, r, () -> orders.submit(a, sid, r));
  }

  @PostMapping("/{item}/status")
  public Object status(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID item,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Status r) {
    var a = Actor.from(jwt);
    orders.authorizeStatus(a, sid, item, r);
    return commands.run(
        a.scope(), key, "order-status:" + sid + item, r, () -> orders.status(a, sid, item, r));
  }
}
