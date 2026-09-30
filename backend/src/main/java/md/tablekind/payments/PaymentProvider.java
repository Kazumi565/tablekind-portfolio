package md.tablekind.payments;

import java.util.UUID;

/**
 * Provider boundary. An unknown outcome must remain PENDING; never infer failure from a timeout.
 */
public interface PaymentProvider {
  record Intent(
      UUID id, UUID restaurantId, String kind, long amountBani, String currency, String status) {}

  record Event(
      UUID eventId,
      UUID intentId,
      UUID restaurantId,
      String kind,
      long amountBani,
      String currency,
      String status) {}

  String name();

  boolean testMode();

  void create(UUID id, UUID restaurantId, String kind, long amountBani);

  Intent lookup(UUID id);

  Intent cancel(UUID id);

  Event verify(byte[] body, String timestamp, String signature);
}
