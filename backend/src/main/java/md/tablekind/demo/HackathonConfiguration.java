package md.tablekind.demo;

import java.util.Arrays;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration
@Profile("hackathon")
public class HackathonConfiguration {
  public HackathonConfiguration(Environment env) {
    if (Arrays.stream(env.getActiveProfiles()).anyMatch(p -> p.equals("local") || p.equals("demo")))
      throw new IllegalStateException(
          "Use hackathon alone with its own database, never local/demo.");
    for (String key : new String[] {"tablekind.jwt-secret", "tablekind.bootstrap-password"})
      if (env.getRequiredProperty(key).length() < 32)
        throw new IllegalStateException("Generate at least 32 characters for " + key);
  }
}
