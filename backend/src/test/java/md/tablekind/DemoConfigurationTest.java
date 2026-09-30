package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import md.tablekind.demo.DemoConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class DemoConfigurationTest {
  private MockEnvironment environment() {
    var env = new MockEnvironment();
    env.setActiveProfiles("demo");
    return env.withProperty("tablekind.jwt-secret", "a".repeat(64))
        .withProperty("tablekind.test-webhook-secret", "b".repeat(64))
        .withProperty("tablekind.bootstrap-password", "c".repeat(64));
  }

  @Test
  void requiresSeparateSecrets() {
    assertDoesNotThrow(() -> new DemoConfiguration(environment()));
    assertThrows(
        IllegalStateException.class,
        () ->
            new DemoConfiguration(
                environment().withProperty("tablekind.bootstrap-password", "Local-Review-2026!")));
    assertThrows(
        IllegalStateException.class,
        () ->
            new DemoConfiguration(environment().withProperty("tablekind.test-webhook-secret", "")));
  }

  @Test
  void refusesLocalProfileAlongsideDemo() {
    var env = environment();
    env.setActiveProfiles("local", "demo");
    assertThrows(IllegalStateException.class, () -> new DemoConfiguration(env));
  }
}
