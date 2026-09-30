package md.tablekind.demo;

import java.util.Arrays;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration
@Profile("demo")
public class DemoConfiguration {
  public DemoConfiguration(Environment env) {
    if (Arrays.asList(env.getActiveProfiles()).contains("local"))
      throw new IllegalStateException(
          "Use demo on its own, never together with the local profile.");
    for (String property :
        new String[] {
          "tablekind.jwt-secret", "tablekind.test-webhook-secret", "tablekind.bootstrap-password"
        }) {
      String value = env.getRequiredProperty(property);
      if (value.length() < 32 || value.startsWith("local-") || value.startsWith("Local-"))
        throw new IllegalStateException(
            "The demo requires a separately generated secret for " + property);
    }
  }
}
