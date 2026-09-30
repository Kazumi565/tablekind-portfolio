package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import md.tablekind.customer.EmailSettings;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class EmailSettingsTest {
  @Test void localMailCannotEnableAnExternalRelay() {
    var env=new MockEnvironment().withProperty("tablekind.email.mode","LOCAL_SMTP").withProperty("tablekind.email.host","smtp.example.com");
    env.setActiveProfiles("local");assertThrows(IllegalStateException.class,()->new EmailSettings(env));
  }
  @Test void hardenedProfileRefusesLocalMailboxVerification() {
    var env=new MockEnvironment().withProperty("tablekind.email.mode","LOCAL_SMTP");env.setActiveProfiles("hardened");
    assertThrows(IllegalStateException.class,()->new EmailSettings(env));
  }
  @Test void emailDefaultsOffAndDemoAllowsGuardedMailpit() {
    assertFalse(new EmailSettings(new MockEnvironment()).enabled());
    var env=new MockEnvironment().withProperty("tablekind.email.mode","LOCAL_SMTP");env.setActiveProfiles("demo");
    assertTrue(new EmailSettings(env).enabled());
  }
}
