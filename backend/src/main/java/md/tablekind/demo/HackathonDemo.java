package md.tablekind.demo;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.ordering.*;
import md.tablekind.paypal.PayPalSettings;
import md.tablekind.restaurant.*;
import md.tablekind.session.Sessions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Fictional EUR fixture, isolated by profile and Compose database. All charges use normal APIs. */
@RestController
@Profile("hackathon")
@RequestMapping("/api/demo")
public class HackathonDemo implements ApplicationRunner {
  private final Db db;
  private final Access access;
  private final Commands commands;
  private final CatalogService catalog;
  private final Sessions sessions;
  private final Orders orders;
  private final PasswordEncoder passwords;
  private final PayPalSettings paypal;
  private final String email, password;
  private final DemoMenu menu;

  public HackathonDemo(
      Db db,
      Access access,
      Commands commands,
      CatalogService catalog,
      Sessions sessions,
      Orders orders,
      PasswordEncoder passwords,
      PayPalSettings paypal,
      DemoMenu menu,
      @Value("${tablekind.bootstrap-email}") String email,
      @Value("${tablekind.bootstrap-password}") String password) {
    this.db = db;
    this.access = access;
    this.commands = commands;
    this.catalog = catalog;
    this.sessions = sessions;
    this.orders = orders;
    this.passwords = passwords;
    this.paypal = paypal;
    this.menu = menu;
    this.email = email;
    this.password = password;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (db.number("SELECT count(*) FROM staff_account") > 0) return;
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO staff_account(id,email,display_name,password_hash) VALUES(?,?,?,?)",
        id,
        email.toLowerCase(Locale.ROOT),
        "Hackathon manager",
        passwords.encode(password));
    catalog.create(new Actor(id, "STAFF", 0), "Tablekind EUR Sandbox", "EUR");
  }

  @GetMapping("/config")
  public Object config() {
    return Map.of("enabled", true, "hackathon", true);
  }

  @PostMapping("/scenarios")
  public Object start(
      @AuthenticationPrincipal Jwt jwt, @RequestHeader("Idempotency-Key") UUID key) {
    var a = Actor.from(jwt);
    access.valid(a);
    if (!a.staff()
        || db.number(
                "SELECT count(*) FROM membership WHERE staff_id=? AND role IN ('OWNER','MANAGER')",
                a.id())
            == 0) throw Problem.forbidden();
    return commands.run(a.scope(), key, "hackathon-scenario", Map.of(), () -> create(a));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> object(Object o) {
    return (Map<String, Object>) o;
  }

  private UUID id(Object o) {
    return Db.id(object(o), "id");
  }

  private Object create(Actor a) {
    db.one("SELECT id FROM staff_account WHERE id=? FOR UPDATE", a.id());
    if (db.number(
            "SELECT count(*) FROM audit_event WHERE actor_id=? AND action='HACKATHON_CREATED' AND"
                + " created_at>now()-interval '1 hour'",
            a.id())
        >= 10)
      throw new Problem(429, "DEMO_LIMIT", "Reuse an existing table or try again in an hour.");
    UUID rid = id(catalog.create(a, "Tablekind · EUR dining demo", "EUR"));
    if (!paypal.merchantId().isBlank())
      db.update(
          "INSERT INTO paypal_merchant(restaurant_id,merchant_id) VALUES(?,?)",
          rid,
          paypal.merchantId());
    UUID bid =
        id(
            catalog.branch(
                a,
                rid,
                new CatalogController.BranchRequest(
                    "Fictional kitchen", "Europe/Chisinau", false, true, List.of())));
    UUID tid =
        id(
            catalog.table(
                a, rid, bid, new CatalogController.TableRequest("Three friends", true, 20)));
    Map<String, UUID> categories = new LinkedHashMap<>();
    for (String name : menu.categories())
      categories.put(
          name,
          id(
              catalog.category(
                  a,
                  rid,
                  new CatalogController.CategoryRequest(Map.of("en", name), categories.size()))));
    var opened = object(sessions.open(a, rid, tid));
    UUID sid = Db.id(opened, "sessionId");
    List<Map<String, Object>> guests = new ArrayList<>();
    for (String name : List.of("Mihai", "Diego", "Ana"))
      guests.add(object(sessions.join(opened.get("joinToken").toString(), name)));
    for (DemoMenu.Dish dish : menu.dishes()) {
      UUID product =
          id(
              catalog.product(
                  a,
                  rid,
                  null,
                  new CatalogController.ProductRequest(
                      categories.get(dish.category()),
                      Map.of("en", dish.name()),
                      Map.of("en", dish.description()),
                      dish.allergens(),
                      dish.dietaryLabels(),
                      dish.price(),
                      true,
                      "/menu/" + dish.image() + ".webp")));
      if (dish.owner() < 0) continue;
      UUID guest = Db.id(guests.get(dish.owner()), "actorId");
      long revision = db.number("SELECT revision FROM table_session WHERE id=?", sid);
      orders.submit(
          a,
          sid,
          new OrderController.Submit(
              revision, product, 1, 1, List.of(), guest, guest, "Hackathon scenario"));
    }
    db.update(
        "INSERT INTO audit_event(restaurant_id,session_id,actor_id,action,detail)"
            + " VALUES(?,?,?,'HACKATHON_CREATED','{}'::jsonb)",
        rid,
        sid,
        a.id());
    return Map.of("restaurantId", rid, "sessionId", sid, "guests", guests);
  }
}
