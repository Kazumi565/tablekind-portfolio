package md.tablekind.restaurant;

import java.util.*;
import md.tablekind.auth.Actor;
import md.tablekind.common.Db;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile({"local", "demo"})
public class LocalBootstrap implements ApplicationRunner {
  private final Db db;
  private final PasswordEncoder passwords;
  private final CatalogService catalog;
  private final String email;
  private final String password;

  public LocalBootstrap(
      Db db,
      PasswordEncoder passwords,
      CatalogService catalog,
      @Value("${tablekind.bootstrap-email}") String email,
      @Value("${tablekind.bootstrap-password}") String password) {
    this.db = db;
    this.passwords = passwords;
    this.catalog = catalog;
    this.email = email;
    this.password = password;
  }

  @Override
  @Transactional
  @SuppressWarnings("unchecked")
  public void run(ApplicationArguments args) {
    // Only seed a completely empty database. Never reset a user's accounts or restaurant data.
    if (db.number("SELECT count(*) FROM staff_account") > 0) return;
    if (email.isBlank() || password.length() < 12)
      throw new IllegalStateException(
          "Local bootstrap requires an email and a password of at least 12 characters.");
    UUID staff = UUID.randomUUID();
    db.update(
        "INSERT INTO staff_account(id,email,display_name,password_hash) VALUES(?,?,?,?)",
        staff,
        email.toLowerCase(Locale.ROOT),
        "Local manager",
        passwords.encode(password));
    Actor actor = new Actor(staff, "STAFF", 0);
    UUID rid =
        (UUID) ((Map<String, Object>) catalog.create(actor, "Tablekind Test Kitchen")).get("id");
    UUID bid =
        (UUID)
            ((Map<String, Object>)
                    catalog.branch(
                        actor,
                        rid,
                        new CatalogController.BranchRequest(
                            "Chișinău", "Europe/Chisinau", true, true, List.of())))
                .get("id");
    for (int n = 1; n <= 5; n++)
      catalog.table(
          actor, rid, bid, new CatalogController.TableRequest("Table %02d".formatted(n), true, 20));
    UUID food =
        (UUID)
            ((Map<String, Object>)
                    catalog.category(
                        actor,
                        rid,
                        new CatalogController.CategoryRequest(
                            Map.of("en", "Food", "ro", "Mâncare", "ru", "Еда"), 0)))
                .get("id");
    UUID drinks =
        (UUID)
            ((Map<String, Object>)
                    catalog.category(
                        actor,
                        rid,
                        new CatalogController.CategoryRequest(
                            Map.of("en", "Drinks", "ro", "Băuturi", "ru", "Напитки"), 1)))
                .get("id");
    var pizza =
        (Map<String, Object>)
            catalog.product(
                actor,
                rid,
                null,
                new CatalogController.ProductRequest(
                    food,
                    Map.of(
                        "en",
                        "Margherita pizza",
                        "ro",
                        "Pizza Margherita",
                        "ru",
                        "Пицца Маргарита"),
                    Map.of("en", "Tomato, mozzarella and basil. Fictional test menu."),
                    List.of("gluten", "milk"),
                    List.of("vegetarian"),
                    18000,
                    true));
    catalog.modifiers(
        actor,
        rid,
        Db.id(pizza, "id"),
        new CatalogController.ModifiersRequest(
            List.of(
                new CatalogController.GroupRequest(
                    Map.of("en", "Extras", "ro", "Suplimente", "ru", "Добавки"),
                    0,
                    2,
                    List.of(
                        new CatalogController.OptionRequest(
                            Map.of(
                                "en",
                                "Extra cheese",
                                "ro",
                                "Cașcaval suplimentar",
                                "ru",
                                "Дополнительный сыр"),
                            2000,
                            true),
                        new CatalogController.OptionRequest(
                            Map.of("en", "Mushrooms", "ro", "Ciuperci", "ru", "Грибы"),
                            1500,
                            true))))));
    catalog.product(
        actor,
        rid,
        null,
        new CatalogController.ProductRequest(
            food,
            Map.of("en", "Pasta", "ro", "Paste", "ru", "Паста"),
            Map.of("en", "Pasta with tomato sauce. Fictional test menu."),
            List.of("gluten"),
            List.of("vegan"),
            14500,
            true));
    catalog.product(
        actor,
        rid,
        null,
        new CatalogController.ProductRequest(
            food,
            Map.of("en", "Burger", "ro", "Burger", "ru", "Бургер"),
            Map.of("en", "Beef, salad and pickles. Fictional test menu."),
            List.of("gluten", "egg", "milk"),
            List.of(),
            16000,
            true));
    catalog.product(
        actor,
        rid,
        null,
        new CatalogController.ProductRequest(
            drinks,
            Map.of("en", "Lemonade", "ro", "Limonadă", "ru", "Лимонад"),
            Map.of("en", "Lemon and mint. Fictional test menu."),
            List.of(),
            List.of("vegan"),
            3500,
            true));
  }
}
