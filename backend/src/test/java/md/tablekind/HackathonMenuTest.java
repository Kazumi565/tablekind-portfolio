package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles(value = "hackathon", inheritProfiles = false)
@TestPropertySource(
    properties = {
      "tablekind.jwt-secret=menu-fixture-only-32-characters-long-and-never-used-in-a-real-deployment",
      "tablekind.bootstrap-email=manager@tablekind.test",
      "tablekind.bootstrap-password=Menu-Review-Only-32-Characters-2026!",
      "tablekind.paypal.enabled=false",
      "tablekind.paypal.worker-enabled=false",
      "tablekind.ai.enabled=false"
    })
class HackathonMenuTest extends WorkflowSupport {
  @BeforeEach
  @Override
  void fixture() {
    staff =
        post(
                null,
                "/auth/login",
                map(
                    "email",
                    "manager@tablekind.test",
                    "password",
                    "Menu-Review-Only-32-Characters-2026!"))
            .path("accessToken")
            .asText();
  }

  @Test
  void fullPhotoMenuKeepsTheFourDishBillAndOriginalDinerOwnership() {
    String key = UUID.randomUUID().toString();
    var response = send(staff, "POST", "/api/demo/scenarios", Map.of(), key);
    assertEquals(200, response.status(), response.body().toString());
    sid = response.body().path("sessionId").asText();
    rid = response.body().path("restaurantId").asText();
    var view = state();
    var menu = view.path("menu");
    List<String> categories = new ArrayList<>();
    menu.path("categories").forEach(c -> categories.add(c.path("names").path("en").asText()));
    assertEquals(17, categories.size());
    assertTrue(categories.containsAll(List.of("Pizza", "Mains", "Starters", "Breakfast", "Soups", "Kids", "Bar")));
    assertEquals("EUR", view.path("currency").asText());
    assertEquals(228, menu.path("products").size());
    var expectedPrices =
        Map.ofEntries(
            Map.entry("Burger", 1200L),
            Map.entry("Pasta", 1000L),
            Map.entry("Salad", 900L),
            Map.entry("Shared starter", 701L),
            Map.entry("Margherita", 950L),
            Map.entry("Pepperoni", 1150L),
            Map.entry("Garden pizza", 1050L),
            Map.entry("Crispy chicken", 1100L),
            Map.entry("Tomato bruschetta", 650L),
            Map.entry("Tiramisu", 550L),
            Map.entry("Berry cheesecake", 550L),
            Map.entry("Citrus lemonade", 350L));
    Set<String> images = new HashSet<>();
    for (var product : menu.path("products")) {
      String name = product.path("names").path("en").asText();
      if (expectedPrices.containsKey(name)) assertEquals(expectedPrices.get(name), product.path("price_bani").asLong(), name);
      assertFalse(product.path("descriptions").path("en").asText().isBlank(), name);
      assertTrue(product.path("image_path").asText().matches("/menu/[a-z0-9-]+\\.webp"), name);
      assertTrue(product.path("available").asBoolean(), name);
      images.add(product.path("image_path").asText());
    }
    assertTrue(images.size() >= 27);
    assertEquals(4, view.path("items").size());
    assertEquals(3801, view.path("bill").path("totalBani").asLong());
    assertEquals(0, view.path("bill").path("paidBani").asLong());
    Map<String, String> dinerNames = new HashMap<>();
    view.path("guests")
        .forEach(g -> dinerNames.put(g.path("id").asText(), g.path("nickname").asText()));
    var expectedOwners =
        Map.of("Burger", "Mihai", "Pasta", "Diego", "Salad", "Ana", "Shared starter", "Mihai");
    for (var item : view.path("items")) {
      String name = item.path("snapshot").path("names").path("en").asText();
      assertEquals(expectedOwners.get(name), dinerNames.get(item.path("ordered_by").asText()));
      assertEquals(expectedPrices.get(name), item.path("total_bani").asLong(), name);
      assertEquals("ACCEPTED", item.path("status").asText());
    }
    var replay = send(staff, "POST", "/api/demo/scenarios", Map.of(), key);
    assertEquals(200, replay.status());
    assertEquals(sid, replay.body().path("sessionId").asText());
    assertEquals(
        menu.path("products").size(), db.number("SELECT count(*) FROM product WHERE restaurant_id=?", UUID.fromString(rid)));
    assertEquals(3801, state().path("bill").path("totalBani").asLong());
  }
}
