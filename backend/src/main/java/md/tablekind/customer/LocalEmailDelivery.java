package md.tablekind.customer;

import java.nio.charset.StandardCharsets;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/** Sends only to the explicitly guarded local capture server. Never logs message contents. */
@Component
public class LocalEmailDelivery {
  private final EmailSettings settings;
  private final JavaMailSenderImpl sender;

  public LocalEmailDelivery(EmailSettings settings) {
    this.settings = settings;
    sender = new JavaMailSenderImpl();
    sender.setHost(settings.host);
    sender.setPort(settings.port);
    sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
    var p = sender.getJavaMailProperties();
    p.setProperty("mail.smtp.connectiontimeout", "2000");
    p.setProperty("mail.smtp.timeout", "2000");
    p.setProperty("mail.smtp.writetimeout", "2000");
  }

  public void send(String recipient, String purpose, String code) {
    if (!settings.enabled()) throw new IllegalStateException("Email delivery is disabled.");
    var message = new SimpleMailMessage();
    message.setFrom("Tablekind TEST <accounts@tablekind.test>");
    message.setTo(recipient);
    message.setSubject(purpose.equals("VERIFY") ? "Tablekind TEST: verify your email" : "Tablekind TEST: reset your password");
    message.setText("LOCAL TEST EMAIL — captured by Mailpit. No real mailbox was contacted.\n\n"
        + (purpose.equals("VERIFY") ? "Your email verification code: " : "Your password reset code: ")
        + code + "\n\nEnter this code in Tablekind within 10 minutes. It works once.\n"
        + "Never share this code. If you did not request it, ignore this message.\n"
        + "This local exercise does not verify ownership of a real email address.");
    sender.send(message);
  }
}
