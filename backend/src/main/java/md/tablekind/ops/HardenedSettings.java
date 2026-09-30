package md.tablekind.ops;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;

/** Opt-in configuration guard, not a claim that real provider adapters or hosting exist. */
@Configuration
@Profile("hardened")
public class HardenedSettings {
  public HardenedSettings(Environment env) {
    if (Arrays.stream(env.getActiveProfiles()).anyMatch(p -> p.equals("local") || p.equals("demo")))
      throw new IllegalStateException(
          "The hardened profile cannot enable local or demo simulators.");
    for (String name : new String[] {"JWT_SECRET", "DB_URL", "DB_USER", "DB_PASSWORD"}) {
      String value = env.getProperty(name, "");
      if (value.isBlank() || value.startsWith("local-only") || value.equals("tablekind-local"))
        throw new IllegalStateException(
            "A non-example " + name + " is required for hardened configuration.");
    }
    if (env.getRequiredProperty("JWT_SECRET").getBytes(StandardCharsets.UTF_8).length < 48)
      throw new IllegalStateException(
          "Use at least 48 random bytes for the hardened signing secret.");
  }
}
