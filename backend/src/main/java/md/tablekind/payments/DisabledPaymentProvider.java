package md.tablekind.payments;

import java.util.UUID;
import md.tablekind.common.Problem;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!local & !demo")
public class DisabledPaymentProvider implements PaymentProvider {
  public String name() {
    return "UNCONFIGURED";
  }

  public boolean testMode() {
    return false;
  }

  private Problem unavailable() {
    return new Problem(
        503,
        "PAYMENTS_UNCONFIGURED",
        "No live payment provider is configured. Use the local profile for simulated payments"
            + " only.");
  }

  public void create(UUID id, UUID restaurantId, String kind, long amountBani) {
    throw unavailable();
  }

  public Intent lookup(UUID id) {
    throw unavailable();
  }

  public Intent cancel(UUID id) {
    throw unavailable();
  }

  public Event verify(byte[] body, String timestamp, String signature) {
    throw unavailable();
  }
}
