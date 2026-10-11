package md.tablekind.paypal;

import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class PayPalHttpClient implements PayPalGateway {
  private static final String BASE = "https://api-m.sandbox.paypal.com";
  private final PayPalSettings settings;
  private final ObjectMapper json;
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
  private String token;
  private Instant tokenExpires = Instant.EPOCH;

  public PayPalHttpClient(PayPalSettings settings, ObjectMapper json) {
    this.settings = settings;
    this.json = json;
  }

  private JsonNode send(HttpRequest request) {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("PayPal IO must be outside database transactions");
    try {
      var r = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (r.statusCode() / 100 != 2 || r.body().length() > 1_000_000)
        throw new IllegalStateException(
            "PayPal response unavailable; reconcile original operation");
      return json.readTree(r.body());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("PayPal request interrupted");
    } catch (java.io.IOException e) {
      throw new IllegalStateException("PayPal outcome uncertain; retry original operation");
    }
  }

  private synchronized String token() {
    if (token != null && Instant.now().isBefore(tokenExpires)) return token;
    if (!settings.configured()) throw new IllegalStateException("PayPal sandbox is not configured");
    String credentials =
        Base64.getEncoder()
            .encodeToString(
                (settings.clientId() + ":" + settings.clientSecret())
                    .getBytes(StandardCharsets.UTF_8));
    var r =
        send(
            HttpRequest.newBuilder(URI.create(BASE + "/v1/oauth2/token"))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Basic " + credentials)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("grant_type=client_credentials"))
                .build());
    token = r.path("access_token").asText();
    if (token.isBlank()) throw new IllegalStateException("PayPal authentication unavailable");
    tokenExpires = Instant.now().plusSeconds(Math.max(1, r.path("expires_in").asLong(60) - 60));
    return token;
  }

  private JsonNode request(String method, String path, Object body, UUID requestId) {
    try {
      var b =
          HttpRequest.newBuilder(URI.create(BASE + path))
              .timeout(Duration.ofSeconds(25))
              .header("Authorization", "Bearer " + token())
              .header("Content-Type", "application/json")
              .header("Prefer", "return=representation");
      if (requestId != null) b.header("PayPal-Request-Id", requestId.toString());
      return send(
          b.method(
                  method,
                  body == null
                      ? HttpRequest.BodyPublishers.noBody()
                      : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
              .build());
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException("Cannot serialize PayPal request");
    }
  }

  public JsonNode create(Order o, UUID key) {
    return request(
        "POST",
        "/v2/checkout/orders",
        Map.of(
            "intent",
            "CAPTURE",
            "purchase_units",
            List.of(
                Map.of(
                    "reference_id",
                    o.paymentId().toString(),
                    "custom_id",
                    o.paymentId().toString(),
                    "payee",
                    Map.of("merchant_id", o.merchantId()),
                    "description",
                    "Tablekind dining share (sandbox)",
                    "amount",
                    Map.of(
                        "currency_code",
                        o.currency(),
                        "value",
                        BigDecimal.valueOf(o.minorUnits(), 2).toPlainString()))),
            "payment_source",
            Map.of(
                "paypal",
                Map.of(
                    "experience_context",
                    Map.of(
                        "shipping_preference",
                        "NO_SHIPPING",
                        "user_action",
                        "PAY_NOW",
                        "return_url",
                        settings.appUrl() + "/guest?paypal=" + o.paymentId(),
                        "cancel_url",
                        settings.appUrl() + "/guest?paypal=" + o.paymentId() + "&cancel=1")))),
        key);
  }

  private String path(String orderId) {
    if (!orderId.matches("[A-Za-z0-9]{5,64}"))
      throw new IllegalStateException("Invalid PayPal reference");
    return "/v2/checkout/orders/" + orderId;
  }

  public JsonNode lookup(String id) {
    return request("GET", path(id), null, null);
  }

  public JsonNode capture(String id, UUID key) {
    return request("POST", path(id) + "/capture", Map.of(), key);
  }
}
