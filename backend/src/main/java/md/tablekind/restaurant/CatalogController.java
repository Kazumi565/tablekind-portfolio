package md.tablekind.restaurant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.Commands;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/restaurants")
public class CatalogController {
  private final CatalogService catalog;
  private final Commands commands;

  public CatalogController(CatalogService catalog, Commands commands) {
    this.catalog = catalog;
    this.commands = commands;
  }

  public record NameRequest(@NotBlank @Size(max = 120) String name) {}

  public record Hours(@Min(1) @Max(7) int day, @NotBlank String opens, @NotBlank String closes) {}

  public record BranchRequest(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Size(max = 60) String timezone,
      boolean approvalRequired,
      boolean acceptingOrders,
      @NotNull @Size(max = 21) List<@Valid Hours> hours) {}

  public record TableRequest(
      @NotBlank @Size(max = 40) String label,
      boolean pilotEnabled,
      @Min(1) @Max(20) int maxGuests) {}

  public record StaffRequest(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(max = 80) String displayName,
      @Size(min = 12, max = 72) @NotNull String password,
      @Pattern(regexp = "MANAGER|WAITER") @NotNull String role) {}

  public record CategoryRequest(@NotNull Map<String, String> names, int sortOrder) {}

  public record ProductRequest(
      @NotNull UUID categoryId,
      @NotNull Map<String, String> names,
      @NotNull Map<String, String> descriptions,
      @NotNull @Size(max = 30) List<@Size(max = 60) String> allergens,
      @NotNull @Size(max = 20) List<@Size(max = 60) String> dietaryLabels,
      @Min(0) @Max(10000000) long priceBani,
      boolean available) {}

  public record OptionRequest(
      @NotNull Map<String, String> names,
      @Min(0) @Max(10000000) long priceBani,
      boolean available) {}

  public record GroupRequest(
      @NotNull Map<String, String> names,
      @Min(0) @Max(20) int minSelect,
      @Min(1) @Max(20) int maxSelect,
      @NotEmpty @Size(max = 20) List<@Valid OptionRequest> options) {}

  public record ModifiersRequest(@NotNull @Size(max = 10) List<@Valid GroupRequest> groups) {}

  public record Availability(boolean available) {}

  @PostMapping
  public Object create(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody NameRequest r) {
    var a = Actor.from(jwt);
    catalog.authorizeCreate(a);
    return commands.run(a.scope(), key, "restaurant", r, () -> catalog.create(a, r.name()));
  }

  @GetMapping("/{rid}")
  public Object dashboard(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid) {
    return catalog.dashboard(Actor.from(jwt), rid);
  }

  @PostMapping("/{rid}/branches")
  public Object branch(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @Valid @RequestBody BranchRequest r) {
    var a = Actor.from(jwt);
    return commands.run(a.scope(), key, "branch:" + rid, r, () -> catalog.branch(a, rid, r));
  }

  @PutMapping("/{rid}/branches/{bid}")
  public Object branchUpdate(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID bid,
      @Valid @RequestBody BranchRequest r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "branch-update:" + rid + bid,
        r,
        () -> catalog.configureBranch(a, rid, bid, r));
  }

  @PostMapping("/{rid}/branches/{bid}/tables")
  public Object table(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID bid,
      @Valid @RequestBody TableRequest r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "table:" + rid + bid, r, () -> catalog.table(a, rid, bid, r));
  }

  @PutMapping("/{rid}/tables/{tid}")
  public Object tableUpdate(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID tid,
      @Valid @RequestBody TableRequest r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "table-update:" + rid + tid,
        r,
        () -> catalog.configureTable(a, rid, tid, r));
  }

  @PostMapping("/{rid}/staff")
  public Object staff(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @Valid @RequestBody StaffRequest r) {
    var a = Actor.from(jwt);
    catalog.authorizeStaffCreation(a, rid, r.role());
    return commands.run(a.scope(), key, "staff:" + rid, r, () -> catalog.addStaff(a, rid, r));
  }

  @DeleteMapping("/{rid}/staff/{sid}")
  public Object removeStaff(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID sid) {
    var a = Actor.from(jwt);
    catalog.authorizeStaffRemoval(a, rid, sid);
    return commands.run(
        a.scope(),
        key,
        "remove-staff:" + rid + sid,
        Map.of(),
        () -> catalog.removeStaff(a, rid, sid));
  }

  public record Role(@NotNull @Pattern(regexp="MANAGER|WAITER") String role) {}
  @PutMapping("/{rid}/staff/{sid}/role")
  public Object role(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid, @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody Role r) {
    var a = Actor.from(jwt);
    catalog.authorizeOwner(a, rid);
    return commands.run(a.scope(), key, "staff-role:" + rid + sid, r, () -> catalog.changeRole(a, rid, sid, r.role()));
  }

  @PostMapping("/{rid}/categories")
  public Object category(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @Valid @RequestBody CategoryRequest r) {
    var a = Actor.from(jwt);
    return commands.run(a.scope(), key, "category:" + rid, r, () -> catalog.category(a, rid, r));
  }

  @PostMapping("/{rid}/products")
  public Object product(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @Valid @RequestBody ProductRequest r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "product:" + rid, r, () -> catalog.product(a, rid, null, r));
  }

  @PutMapping("/{rid}/products/{pid}")
  public Object updateProduct(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID pid,
      @Valid @RequestBody ProductRequest r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "product-update:" + rid + pid, r, () -> catalog.product(a, rid, pid, r));
  }

  @PutMapping("/{rid}/products/{pid}/availability")
  public Object available(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID pid,
      @Valid @RequestBody Availability r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(),
        key,
        "availability:" + rid + pid,
        r,
        () -> catalog.availability(a, rid, pid, r.available()));
  }

  @PutMapping("/{rid}/products/{pid}/modifiers")
  public Object modifiers(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader("Idempotency-Key") UUID key,
      @PathVariable UUID rid,
      @PathVariable UUID pid,
      @Valid @RequestBody ModifiersRequest r) {
    var a = Actor.from(jwt);
    return commands.run(
        a.scope(), key, "modifiers:" + rid + pid, r, () -> catalog.modifiers(a, rid, pid, r));
  }
}
