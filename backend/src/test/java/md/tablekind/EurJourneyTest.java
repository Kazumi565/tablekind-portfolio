package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.util.*;
import md.tablekind.ai.SplitAiClient;
import md.tablekind.auth.Actor;
import md.tablekind.common.Db;
import md.tablekind.paypal.*;
import md.tablekind.restaurant.CatalogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

@TestPropertySource(
    properties = {
      "tablekind.paypal.enabled=true",
      "tablekind.paypal.client-id=fixture-client",
      "tablekind.paypal.client-secret=fixture-secret",
      "tablekind.paypal.merchant-id=MERCHANT123",
      "tablekind.paypal.worker-enabled=false",
      "tablekind.ai.enabled=true",
      "tablekind.ai.api-key=fixture-only",
      "tablekind.ai.max-calls=100000"
    })
class EurJourneyTest extends WorkflowSupport {
  @Autowired CatalogService catalog;
  @Autowired PayPalPayments paypal;
  @MockitoBean PayPalGateway gateway;
  @MockitoBean SplitAiClient ai;

  @Override
  @SuppressWarnings("unchecked")
  String createFixtureRestaurant() {
    return new TransactionTemplate(tx)
        .execute(
            t -> {
              var actor =
                  new Actor(
                      Db.id(
                          db.one(
                              "SELECT id FROM staff_account WHERE email='manager@tablekind.test'"),
                          "id"),
                      "STAFF",
                      0);
              var r = (Map<String, Object>) catalog.create(actor, "Three diner EUR journey", "EUR");
              db.update(
                  "INSERT INTO paypal_merchant(restaurant_id,merchant_id) VALUES(?,'MERCHANT123')",
                  r.get("id"));
              return r.get("id").toString();
            });
  }

  String dish(String name, long price, String diner) {
    var category =
        db.one("SELECT category_id FROM product WHERE id=?", UUID.fromString(pid))
            .get("category_id");
    String product =
        post(
                staff,
                "/restaurants/" + rid + "/products",
                map(
                    "categoryId",
                    category,
                    "names",
                    map("en", name),
                    "descriptions",
                    map("en", "Fictional EUR dish"),
                    "allergens",
                    List.of(),
                    "dietaryLabels",
                    List.of(),
                    "priceBani",
                    price,
                    "available",
                    true))
            .path("id")
            .asText();
    String item =
        action(
                diner,
                "/orders",
                "productId",
                product,
                "productVersion",
                1,
                "quantity",
                1,
                "optionIds",
                List.of(),
                "note",
                "")
            .path("id")
            .asText();
    action(staff, "/orders/" + item + "/status", "status", "ACCEPTED", "reason", "");
    return item;
  }

  com.fasterxml.jackson.databind.JsonNode order(UUID id, boolean captured) {
    var p = db.one("SELECT amount_bani,tip_bani FROM payment_attempt WHERE id=?", id);
    var amount =
        map(
            "currency_code",
            "EUR",
            "value",
            BigDecimal.valueOf(Db.amount(p, "amount_bani") + Db.amount(p, "tip_bani"), 2)
                .toPlainString());
    var unit = map("custom_id", id, "payee", map("merchant_id", "MERCHANT123"), "amount", amount);
    if (captured)
      unit.put(
          "payments",
          map(
              "captures",
              List.of(
                  map(
                      "id",
                      "CAPTURE" + id.toString().replace("-", ""),
                      "status",
                      "COMPLETED",
                      "amount",
                      amount))));
    return json.valueToTree(
        map(
            "id",
            "ORDER" + id.toString().replace("-", ""),
            "intent",
            "CAPTURE",
            "status",
            captured ? "COMPLETED" : "APPROVED",
            "purchase_units",
            List.of(unit),
            "links",
            List.of(
                map(
                    "rel",
                    "payer-action",
                    "href",
                    "https://www.sandbox.paypal.com/checkoutnow?token=FIXTURE123"))));
  }

  @Test
  void threeDinersReviewConsentAndPayExactly3801WithSeparateTips() {
    var ana = post(null, "/join", map("token", join, "nickname", "Ana"));
    String c = ana.path("actorId").asText(), ct = ana.path("accessToken").asText();
    dish("Burger", 1200, at);
    dish("Pasta", 1000, bt);
    dish("Salad", 900, ct);
    String starter = dish("Shared starter", 701, at);
    var shares =
        List.of(a, b, c).stream().map(g -> new SplitAiClient.Share(UUID.fromString(g), 1)).toList();
    when(ai.interpret(anyString(), anyMap()))
        .thenReturn(
            new SplitAiClient.Interpretation(
                "READY",
                "",
                "Everyone shares the starter equally",
                List.of(new SplitAiClient.Allocation(UUID.fromString(starter), "EQUAL", shares))));
    var preview =
        action(
            at,
            "/ai-splits/preview",
            "instruction",
            "Mihai pays for the burger, Diego pays for the pasta, and everyone shares the starter"
                + " equally.");
    assertEquals("READY", preview.path("status").asText());
    assertEquals(1901, due(a));
    String proposal =
        action(at, "/ai-splits/" + preview.path("draftId").asText() + "/confirm")
            .path("proposalId")
            .asText();
    action(bt, "/proposals/" + proposal + "/vote", "accept", true);
    assertEquals(1901, due(a));
    action(ct, "/proposals/" + proposal + "/vote", "accept", true);
    assertEquals(3801, due(a) + due(b) + due(c));
    assertTrue(Set.of(1433L, 1434L).contains(due(a)));
    assertTrue(Set.of(1233L, 1234L).contains(due(b)));
    assertTrue(Set.of(1133L, 1134L).contains(due(c)));
    Map<String, UUID> external = new HashMap<>();
    when(gateway.create(any(), any()))
        .thenAnswer(
            call -> {
              var o = (PayPalGateway.Order) call.getArgument(0);
              var reply = order(o.paymentId(), false);
              external.put(reply.path("id").asText(), o.paymentId());
              return reply;
            });
    when(gateway.lookup(anyString()))
        .thenAnswer(call -> order(external.get(call.getArgument(0)), false));
    when(gateway.capture(anyString(), any()))
        .thenAnswer(call -> order(external.get(call.getArgument(0)), true));
    for (String token : List.of(at, bt, ct)) {
      UUID payment =
          UUID.fromString(action(token, "/paypal", "tipMinor", 100).path("paymentId").asText());
      paypal.process(payment);
      action(token, "/paypal/" + payment + "/approve");
      paypal.process(payment);
      paypal.process(payment);
      var receipt =
          ok(token, "GET", "/api/sessions/" + sid + "/payments/" + payment + "/confirmation", null);
      assertEquals("EUR", receipt.path("restaurant").path("currency").asText());
    }
    var bill = state().path("bill");
    assertEquals(3801, bill.path("paidBani").asLong());
    assertEquals(0, bill.path("remainingBani").asLong());
    assertEquals(0, bill.path("reservedBani").asLong());
    assertEquals(
        300,
        db.number(
            "SELECT sum(tip_bani) FROM payment_attempt WHERE session_id=? AND status='SUCCEEDED'",
            UUID.fromString(sid)));
    verify(gateway, times(3)).capture(anyString(), any());
  }
}
