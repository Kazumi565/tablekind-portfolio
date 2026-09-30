package md.tablekind.pos;

import java.util.*;

/** All calls execute outside the order transaction. Adapters must enforce timeouts and identity. */
public interface PosConnector {
  String name();

  boolean testOnly();

  Receipt apply(Command command);

  RemoteBill readBill(UUID restaurantId, UUID sessionId);

  Catalog readCatalog(UUID restaurantId);

  record Command(
      UUID id, UUID restaurantId, UUID sessionId, long revision, String fingerprint, Bill bill) {}

  record Receipt(
      UUID commandId,
      UUID restaurantId,
      UUID sessionId,
      long revision,
      String fingerprint,
      String externalBillId) {}

  record Bill(
      UUID restaurantId,
      UUID sessionId,
      String tableRef,
      String tableLabel,
      String currency,
      String status,
      List<Line> lines,
      List<Tender> payments,
      List<Refund> refunds,
      long totalBani,
      long paidBani,
      long tipBani) {}

  record Line(
      UUID id,
      String productRef,
      Map<String, String> names,
      int quantity,
      long unitBani,
      long totalBani,
      String status,
      String note,
      List<Choice> options,
      List<Charge> charges) {}

  record Choice(String externalId, Map<String, String> names, long priceBani) {}

  record Charge(UUID id, long amountBani, String kind, String reason) {}

  record Tender(
      UUID id, String method, long amountBani, long tipBani, boolean test, String reference) {}

  record Refund(
      UUID id, UUID paymentId, long amountBani, long tipBani, String mode, String reason) {}

  record RemoteBill(
      UUID restaurantId,
      UUID sessionId,
      long revision,
      String externalBillId,
      Bill bill,
      Map<UUID, String> kitchenStatuses) {}

  record Catalog(long revision, List<Product> products) {}

  record Product(
      String externalId,
      String categoryRef,
      Map<String, String> categoryNames,
      Map<String, String> names,
      Map<String, String> descriptions,
      List<String> allergens,
      List<String> dietaryLabels,
      long priceBani,
      boolean available,
      List<Group> groups) {}

  record Group(
      String externalId,
      Map<String, String> names,
      int minSelect,
      int maxSelect,
      List<Option> options) {}

  record Option(String externalId, Map<String, String> names, long priceBani, boolean available) {}

  final class Failure extends RuntimeException {
    private final boolean retryable;

    public Failure(String safeMessage, boolean retryable) {
      super(safeMessage);
      this.retryable = retryable;
    }

    public boolean retryable() {
      return retryable;
    }
  }
}
