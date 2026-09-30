package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import md.tablekind.ops.HardenedSettings;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class HardenedSettingsTest {
  MockEnvironment configured() {
    var env =
        new MockEnvironment()
            .withProperty("JWT_SECRET", "x".repeat(64))
            .withProperty("DB_URL", "jdbc:postgresql://db/tablekind")
            .withProperty("DB_USER", "operator")
            .withProperty("DB_PASSWORD", "fixture-non-default-password");
    env.setActiveProfiles("hardened");
    return env;
  }

  @Test
  void explicitCredentialsAreRequired() {
    assertDoesNotThrow(() -> new HardenedSettings(configured()));
    assertThrows(IllegalStateException.class, () -> new HardenedSettings(new MockEnvironment()));
    assertThrows(
        IllegalStateException.class,
        () -> new HardenedSettings(configured().withProperty("DB_PASSWORD", "tablekind-local")));
    assertThrows(
        IllegalStateException.class,
        () -> new HardenedSettings(configured().withProperty("JWT_SECRET", "x".repeat(32))));
  }

  @Test
  void testProfilesCannotBeCombinedWithHardened() {
    for (String p : new String[] {"local", "demo"}) {
      var env = configured();
      env.setActiveProfiles("hardened", p);
      assertThrows(IllegalStateException.class, () -> new HardenedSettings(env));
    }
  }
}
