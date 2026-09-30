package md.tablekind.restaurant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/restaurants/{rid}")
public class Onboarding {
  private final Db db;
  private final Access access;
  private final Commands commands;
  private final CatalogService catalog;

  public Onboarding(Db db, Access access, Commands commands, CatalogService catalog) {
    this.db = db;
    this.access = access;
    this.commands = commands;
    this.catalog = catalog;
  }

  public record Policy(
      @NotNull @Pattern(regexp = "ORDER_AND_PAY|PAY_AT_TABLE") String operatingMode,
      @NotEmpty @Size(max = 3) List<@NotNull @Pattern(regexp = "en|ro|ru") String> languages,
      @NotNull @Pattern(regexp = "en|ro|ru") String defaultLanguage) {}

  @PutMapping("/branches/{bid}/policy")
  public Object policy(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @PathVariable UUID bid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Policy r) {
    Actor a = Actor.from(jwt);
    access.manager(a, rid);
    if (!r.languages().contains(r.defaultLanguage())
        || new HashSet<>(r.languages()).size() != r.languages().size())
      throw Problem.bad("Choose unique languages and include the default language.");
    return commands.run(
        a.scope(),
        key,
        "branch-policy:" + rid + bid,
        r,
        () -> {
          if (db.update(
                  "UPDATE branch SET operating_mode=?,languages=?::jsonb,default_language=? WHERE"
                      + " restaurant_id=? AND id=?",
                  r.operatingMode(),
                  db.json(r.languages()),
                  r.defaultLanguage(),
                  rid,
                  bid)
              != 1) throw Problem.missing();
          catalog.audit(
              a,
              rid,
              "BRANCH_POLICY_UPDATED",
              Map.of(
                  "branchId", bid, "operatingMode", r.operatingMode(), "languages", r.languages()));
          return Map.of("id", bid);
        });
  }

  @GetMapping("/onboarding")
  public Object checklist(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid) {
    access.manager(Actor.from(jwt), rid);
    var checks = new LinkedHashMap<String, Boolean>();
    checks.put("branch", db.number("SELECT count(*) FROM branch WHERE restaurant_id=?", rid) > 0);
    checks.put(
        "pilotTables",
        db.number("SELECT count(*) FROM dining_table WHERE restaurant_id=? AND pilot_enabled", rid)
            > 0);
    checks.put(
        "printedLinks",
        db.number(
                "SELECT count(*) FROM dining_table WHERE restaurant_id=? AND pilot_enabled AND"
                    + " qr_version IS NOT NULL",
                rid)
            > 0);
    checks.put(
        "menu",
        db.number("SELECT count(*) FROM product WHERE restaurant_id=? AND available", rid) > 0);
    checks.put(
        "staff",
        db.number("SELECT count(*) FROM membership WHERE restaurant_id=? AND role='WAITER'", rid)
            > 0);
    checks.put(
        "testOrder",
        db.number(
                "SELECT count(*) FROM order_item WHERE restaurant_id=? AND status IN"
                    + " ('ACCEPTED','PREPARING','READY','SERVED')",
                rid)
            > 0);
    checks.put(
        "testPayment",
        db.number(
                "SELECT count(*) FROM payment_attempt WHERE restaurant_id=? AND status='SUCCEEDED'",
                rid)
            > 0);
    checks.put(
        "testPos", db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=?", rid) > 0);
    return Map.of(
        "checks",
        checks,
        "liveReady",
        false,
        "note",
        "Practice setup only. Live payments, receipts and POS connections must be configured and"
            + " verified before use with real customers.");
  }

  @GetMapping("/audit")
  public Object audit(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID rid,
      @RequestParam(defaultValue = "0") long before) {
    access.manager(Actor.from(jwt), rid);
    return db.list(
        "SELECT id,session_id,actor_id,action,detail,created_at FROM audit_event WHERE"
            + " restaurant_id=? AND (?=0 OR id<?) ORDER BY id DESC LIMIT 50",
        rid,
        before,
        before);
  }
}
