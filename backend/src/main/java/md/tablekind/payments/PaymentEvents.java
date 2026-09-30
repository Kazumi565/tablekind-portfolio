package md.tablekind.payments;

import java.nio.charset.StandardCharsets;
import md.tablekind.common.Commands;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentEvents {
  private final PaymentProvider provider;
  private final Payments payments;

  public PaymentEvents(PaymentProvider provider, Payments payments) {
    this.provider = provider;
    this.payments = payments;
  }

  @Transactional
  public Object receive(byte[] body, String timestamp, String signature) {
    var event = provider.verify(body, timestamp, signature);
    return payments.event(event, Commands.hash(new String(body, StandardCharsets.UTF_8)));
  }
}
