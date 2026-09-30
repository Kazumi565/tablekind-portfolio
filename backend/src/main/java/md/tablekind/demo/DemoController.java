package md.tablekind.demo;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.pos.PosService;
import md.tablekind.restaurant.*;
import md.tablekind.session.Sessions;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Practice setup only. Every subsequent order, allocation and payment uses the normal API. */
@RestController
@Profile("demo")
@RequestMapping("/api/demo")
public class DemoController {
  private final Access access;
  private final Commands commands;
  private final CatalogService catalog;
  private final Sessions sessions;
  private final PosService pos;
  private final Db db;

  public DemoController(
      Access access,
      Commands commands,
      CatalogService catalog,
      Sessions sessions,
      PosService pos,
      Db db) {
    this.access = access;
    this.commands = commands;
    this.catalog = catalog;
    this.sessions = sessions;
    this.pos = pos;
    this.db = db;
  }

  @GetMapping("/config")
  public Object config() {
    return Map.of("enabled", true);
  }

  @PostMapping("/scenarios")
  public Object start(
      @AuthenticationPrincipal Jwt jwt, @RequestHeader("Idempotency-Key") UUID key) {
    var actor = Actor.from(jwt);
    access.valid(actor);
    if (!actor.staff()
        || db.number(
                "SELECT count(*) FROM membership WHERE staff_id=? AND role IN ('OWNER','MANAGER')", actor.id())
            == 0) throw Problem.forbidden();
    // Authorize before replay: cached guest credentials must not bypass a revoked manager.
    return commands.run(actor.scope(), key, "demo-scenario", Map.of(), () -> create(actor));
  }

  private Object create(Actor actor) {
    // Serialize setup by this manager and cap accidental repeated practice creation.
    db.one("SELECT id FROM staff_account WHERE id=? FOR UPDATE", actor.id());
    if (db.number(
            "SELECT count(*) FROM audit_event WHERE actor_id=? AND action='DEMO_CREATED'"
                + " AND created_at > now() - interval '1 hour'",
            actor.id())
        >= 10)
      throw new Problem(
          429,
          "DEMO_LIMIT",
          "You have started ten practice tables this hour. Reuse one or try later.");
    UUID rid =
        id(catalog.create(actor, "Practice " + UUID.randomUUID().toString().substring(0, 8)));
    UUID bid =
        id(
            catalog.branch(
                actor,
                rid,
                new CatalogController.BranchRequest(
                    "Demo kitchen", "Europe/Chisinau", true, true, List.of())));
    UUID tid =
        id(
            catalog.table(
                actor, rid, bid, new CatalogController.TableRequest("Practice table", true, 20)));
    UUID category =
        id(
            catalog.category(
                actor,
                rid,
                new CatalogController.CategoryRequest(Map.of("en", "Practice menu"), 0)));
    catalog.product(
        actor,
        rid,
        null,
        new CatalogController.ProductRequest(
            category,
            Map.of("en", "Shared pizza", "ro", "Pizza de împărțit", "ru", "Пицца на двоих"),
            Map.of("en", "Tomato, mozzarella and basil. Try sharing this between two people."),
            List.of("gluten", "milk"),
            List.of("vegetarian"),
            18101,
            true));
    catalog.product(
        actor,
        rid,
        null,
        new CatalogController.ProductRequest(
            category,
            Map.of("en", "Lemonade", "ro", "Limonadă", "ru", "Лимонад"),
            Map.of("en", "An optional drink if you want to try a bigger order."),
            List.of(),
            List.of("vegan"),
            3500,
            true));
    // Connect before opening: the ordinary POS tracking rules deliberately exclude old sessions.
    pos.connect(actor, rid);
    var opened = object(sessions.open(actor, rid, tid));
    String token = (String) opened.get("joinToken");
    var first = sessions.join(token, "Mihai");
    var second = sessions.join(token, "Diego");
    db.update(
        "INSERT INTO audit_event(restaurant_id,session_id,actor_id,action,detail)"
            + " VALUES(?,?,?,'DEMO_CREATED','{}'::jsonb)",
        rid,
        opened.get("sessionId"),
        actor.id());
    return Map.of(
        "restaurantId",
        rid,
        "sessionId",
        opened.get("sessionId"),
        "guests",
        List.of(first, second));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> object(Object value) {
    return (Map<String, Object>) value;
  }

  private static UUID id(Object value) {
    return (UUID) object(value).get("id");
  }
}
