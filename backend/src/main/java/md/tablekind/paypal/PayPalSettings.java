package md.tablekind.paypal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public record PayPalSettings(
    @Value("${tablekind.paypal.enabled:false}") boolean enabled,
    @Value("${tablekind.paypal.client-id:}") String clientId,
    @Value("${tablekind.paypal.client-secret:}") String clientSecret,
    @Value("${tablekind.paypal.merchant-id:}") String merchantId,
    @Value("${tablekind.paypal.app-url:http://localhost:5195}") String appUrl) {
  public PayPalSettings {
    var uri = java.net.URI.create(appUrl);
    boolean local = SetHolder.LOCAL.contains(uri.getHost());
    if (!("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))
        || uri.getUserInfo() != null
        || uri.getQuery() != null
        || uri.getFragment() != null
        || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
      throw new IllegalArgumentException(
          "PayPal app URL must be an HTTPS origin (HTTP allowed on localhost).");
    appUrl = appUrl.replaceAll("/+$", "");
  }

  private static class SetHolder {
    static final java.util.Set<String> LOCAL = java.util.Set.of("localhost", "127.0.0.1", "[::1]");
  }

  public boolean configured() {
    return enabled && !clientId.isBlank() && !clientSecret.isBlank() && !merchantId.isBlank();
  }

  @Override
  public String toString() {
    return "PayPalSettings[credentials redacted]";
  }
}
