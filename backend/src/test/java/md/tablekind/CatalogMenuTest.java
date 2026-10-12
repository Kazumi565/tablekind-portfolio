package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class CatalogMenuTest extends WorkflowSupport {
  private Map<String, Object> product(String imagePath) {
    return map(
        "categoryId",
            db.one("SELECT category_id FROM product WHERE id=?", UUID.fromString(pid))
                .get("category_id"),
        "names", map("en", "Updated pizza"),
        "descriptions", map("en", "Tomato, mozzarella and basil."),
        "allergens", List.of("wheat", "milk"),
        "dietaryLabels", List.of("vegetarian"),
        "priceBani", 9000,
        "available", true,
        "imagePath", imagePath);
  }

  @Test
  void optionalLocalPhotoIsReturnedToGuestsWithoutChangingAcceptedItems() {
    String acceptedItem = item();
    var before = state();
    assertTrue(before.path("menu").path("products").get(0).path("image_path").isNull());

    var changed =
        ok(
            staff,
            "PUT",
            "/api/restaurants/" + rid + "/products/" + pid,
            product("/menu/garden-pizza.webp"));
    assertEquals("/menu/garden-pizza.webp", changed.path("image_path").asText());
    assertEquals(2, changed.path("version").asInt());

    var guestView = ok(at, "GET", "/api/sessions/" + sid, null);
    var menuProduct = guestView.path("menu").path("products").get(0);
    assertEquals("/menu/garden-pizza.webp", menuProduct.path("image_path").asText());
    assertEquals(9000, menuProduct.path("price_bani").asLong());
    var historicalItem = guestView.path("items").get(0);
    assertEquals(acceptedItem, historicalItem.path("id").asText());
    assertEquals(10001, historicalItem.path("unit_price_bani").asLong());
    assertEquals("Pizza", historicalItem.path("snapshot").path("names").path("en").asText());
    assertEquals(10001, guestView.path("bill").path("totalBani").asLong());

    var withoutPhoto =
        ok(staff, "PUT", "/api/restaurants/" + rid + "/products/" + pid, product(null));
    assertTrue(withoutPhoto.path("image_path").isNull());
    assertTrue(state().path("menu").path("products").get(0).path("image_path").isNull());
  }

  @Test
  void productImagesCannotReferenceRemoteResourcesOrEscapeTheMenuDirectory() {
    for (String path :
        List.of(
            "https://example.com/pizza.webp",
            "//example.com/pizza.webp",
            "/menu/../pizza.webp",
            "/menu/%2e%2e/pizza.webp",
            "menu/pizza.webp",
            "/menu/pizza.webp?redirect=https://example.com",
            "/menu/pizza.svg",
            "/menu/pizza.webp\n",
            "")) {
      var reply =
          send(
              staff,
              "POST",
              "/api/restaurants/" + rid + "/products",
              product(path),
              UUID.randomUUID().toString());
      assertEquals(400, reply.status(), path);
    }
    assertEquals(
        1, db.number("SELECT count(*) FROM product WHERE restaurant_id=?", UUID.fromString(rid)));
  }
}
