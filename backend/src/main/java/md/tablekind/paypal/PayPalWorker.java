package md.tablekind.paypal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PayPalWorker {
  private final PayPalPayments payments;
  private final PayPalSettings settings;
  private final boolean enabled;

  public PayPalWorker(
      PayPalPayments payments,
      PayPalSettings settings,
      @Value("${tablekind.paypal.worker-enabled:true}") boolean enabled) {
    this.payments = payments;
    this.settings = settings;
    this.enabled = enabled;
  }

  @Scheduled(fixedDelay = 2000, initialDelay = 3000)
  public void tick() {
    if (enabled && settings.configured()) for (var id : payments.due()) payments.process(id);
  }
}
