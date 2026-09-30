package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import md.tablekind.auth.*;
import org.junit.jupiter.api.Test;

class SecurityPrimitivesTest {
  @Test
  void rfc6238Sha1VectorsAndReplayWindow() {
    String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    assertEquals("287082", Totp.code(secret, 59 / 30));
    assertEquals("081804", Totp.code(secret, 1111111109L / 30));
    assertEquals("050471", Totp.code(secret, 1111111111L / 30));
    assertEquals("005924", Totp.code(secret, 1234567890L / 30));
    assertEquals("279037", Totp.code(secret, 2000000000L / 30));
    assertEquals("353130", Totp.code(secret, 20000000000L / 30));
    assertEquals(1, Totp.match(secret, "287082", 59, -1));
    assertEquals(-1, Totp.match(secret, "287082", 59, 1));
    assertEquals(-1, Totp.match(secret, "287082", 150, -1));
    assertEquals(-1, Totp.match(secret, null, 59, -1));
  }

  @Test
  void seedsAreRandomizedEncryptedAndBoundToTheirOwner() {
    var box = new SecretBox("test-key-only-this-is-not-a-live-secret");
    var id = UUID.randomUUID();
    String seed = Totp.secret();
    String one = box.seal(id, seed), two = box.seal(id, seed);
    assertNotEquals(one, two);
    assertFalse(one.contains(seed));
    assertEquals(seed, box.open(id, one));
    assertThrows(IllegalStateException.class, () -> box.open(UUID.randomUUID(), one));
    assertThrows(IllegalStateException.class, () -> new SecretBox("different-key").open(id, one));
  }
}
