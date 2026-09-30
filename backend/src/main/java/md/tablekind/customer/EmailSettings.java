package md.tablekind.customer;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Local capture only. Refuse accidental outbound SMTP or use in hardened deployments. */
@Component
public class EmailSettings {
  public final String mode;
  public final String host;
  public final int port;
  public final boolean workerEnabled;

  public EmailSettings(Environment env) {
    mode = env.getProperty("tablekind.email.mode", "OFF");
    host = env.getProperty("tablekind.email.host", "mailpit");
    port = env.getProperty("tablekind.email.port", Integer.class, 1025);
    workerEnabled = env.getProperty("tablekind.email.worker-enabled", Boolean.class, true);
    if (!Set.of("OFF", "LOCAL_SMTP").contains(mode))
      throw new IllegalStateException("Email mode must be OFF or LOCAL_SMTP; live delivery is not configured.");
    if (enabled() && (Arrays.asList(env.getActiveProfiles()).contains("hardened")
        || Arrays.stream(env.getActiveProfiles()).noneMatch(p -> p.equals("local") || p.equals("demo"))))
      throw new IllegalStateException("Local email capture requires the local or demo profile.");
    if (enabled() && (!Set.of("mailpit", "localhost", "127.0.0.1", "::1").contains(host)
        || port < 1024 || port > 65535))
      throw new IllegalStateException("Local SMTP must use Mailpit or a loopback host on an unprivileged port.");
  }

  public boolean enabled() { return mode.equals("LOCAL_SMTP"); }
  public Map<String,Object> publicConfig() {
    return Map.of("enabled", enabled(), "mode", mode, "testOnly", true,
        "codeDigits", 8, "expiresMinutes", 10, "resendSeconds", 60);
  }
}
