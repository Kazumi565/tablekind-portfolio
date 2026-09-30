package md.tablekind.pos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import java.util.function.Supplier;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/restaurants/{rid}/pos")
public class PosController {
  private final PosService service;
  private final PosWorker worker;
  private final Commands commands;

  public PosController(PosService service, PosWorker worker, Commands commands) {
    this.service = service;
    this.worker = worker;
    this.commands = commands;
  }

  public record Pause(boolean paused) {}

  public record Mode(@NotNull @Pattern(regexp = "ONLINE|OFFLINE|LOSE_REPLY|REJECT") String mode) {}

  public record Product(@Min(0) @Max(10000000) long priceBani, boolean available) {}

  public record TestBill(
      UUID itemId,
      @NotNull @Pattern(regexp = "ACCEPTED|PREPARING|READY|SERVED") String status,
      @Min(-1000000000) @Max(1000000000) long offsetBani) {}

  private Object command(
      Actor a, UUID rid, UUID key, String operation, Object body, Supplier<Object> change) {
    // Check manager authority before replaying a previously authorized command.
    service.manager(a, rid);
    return commands.run(a.scope(), key, "pos:" + rid + ":" + operation, body, change);
  }

  @GetMapping
  public Object state(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid) {
    return service.dashboard(Actor.from(jwt), rid);
  }

  @PostMapping("/connect-test")
  public Object connect(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @RequestHeader("Idempotency-Key") UUID key) {
    var a = Actor.from(jwt);
    return command(a, rid, key, "connect", Map.of(), () -> service.connect(a, rid));
  }

  @PostMapping("/pause")
  public Object pause(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Pause r) {
    var a = Actor.from(jwt);
    return command(a, rid, key, "pause", r, () -> service.pause(a, rid, r.paused()));
  }

  @PostMapping("/messages/{id}/retry")
  public Object retry(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key) {
    var a = Actor.from(jwt);
    return command(a, rid, key, "retry:" + id, Map.of(), () -> service.retry(a, rid, id));
  }

  @PostMapping("/catalog/import")
  public Object catalog(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @RequestHeader("Idempotency-Key") UUID key) {
    var a = Actor.from(jwt);
    service.manager(a, rid);
    var prior = commands.replay(a.scope(), key, "pos:" + rid + ":import-catalog", Map.of());
    if (prior.isPresent()) return prior.get();
    var source = remote(() -> worker.connector(rid).readCatalog(rid));
    return command(
        a, rid, key, "import-catalog", Map.of(), () -> service.importCatalog(a, rid, source));
  }

  @PostMapping("/sessions/{sid}/reconcile")
  public Object reconcile(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid, @PathVariable UUID sid) {
    var a = Actor.from(jwt);
    service.staff(a, rid);
    var bill = remote(() -> worker.connector(rid).readBill(rid, sid));
    return service.reconcile(a, rid, sid, bill);
  }

  @PostMapping("/sessions/{sid}/kitchen/import")
  public Object kitchen(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key) {
    var a = Actor.from(jwt);
    service.manager(a, rid);
    var prior = commands.replay(a.scope(), key, "pos:" + rid + ":import-kitchen:" + sid, Map.of());
    if (prior.isPresent()) return prior.get();
    var bill = remote(() -> worker.connector(rid).readBill(rid, sid));
    return command(
        a,
        rid,
        key,
        "import-kitchen:" + sid,
        Map.of(),
        () -> service.importKitchen(a, rid, sid, bill));
  }

  @PostMapping("/mock/mode")
  public Object mode(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Mode r) {
    var a = Actor.from(jwt);
    return command(a, rid, key, "mock-mode", r, () -> service.mockMode(a, rid, r.mode()));
  }

  @PostMapping("/mock/products/{pid}")
  public Object product(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @PathVariable UUID pid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Product r) {
    var a = Actor.from(jwt);
    return command(
        a,
        rid,
        key,
        "mock-product:" + pid,
        r,
        () -> service.mockProduct(a, rid, pid, r.priceBani(), r.available()));
  }

  @PostMapping("/mock/sessions/{sid}")
  public Object mockBill(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody TestBill r) {
    var a = Actor.from(jwt);
    return command(
        a,
        rid,
        key,
        "mock-bill:" + sid,
        r,
        () -> service.mockBill(a, rid, sid, r.itemId(), r.status(), r.offsetBani()));
  }

  private <T> T remote(Supplier<T> action) {
    try {
      return action.get();
    } catch (PosConnector.Failure e) {
      throw new Problem(503, "POS_UNAVAILABLE", e.getMessage());
    }
  }
}
