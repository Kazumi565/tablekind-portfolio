package md.tablekind.paypal;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

/** All methods perform external IO; callers must commit recovery state before dispatch. */
public interface PayPalGateway {
  record Order(UUID paymentId, String merchantId, String currency, long minorUnits) {}

  JsonNode create(Order order, UUID requestId);

  JsonNode lookup(String orderId);

  JsonNode capture(String orderId, UUID requestId);
}
