package md.tablekind.auth;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Domain-separated key derivation; encrypted MFA seeds are bound to the account ID. */
@Component
public class SecretBox {
  private final byte[] key;
  private final SecureRandom random = new SecureRandom();

  public SecretBox(@Value("${tablekind.jwt-secret}") String secret) {
    try {
      key =
          MessageDigest.getInstance("SHA-256")
              .digest(("tablekind:mfa:v1:" + secret).getBytes(StandardCharsets.UTF_8));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  public String seal(UUID owner, String value) {
    try {
      byte[] iv = new byte[12];
      random.nextBytes(iv);
      Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
      c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
      c.updateAAD(owner.toString().getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(iv)
          + "."
          + Base64.getEncoder().encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  public String open(UUID owner, String value) {
    try {
      String[] parts = value.split("\\.");
      Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
      c.init(
          Cipher.DECRYPT_MODE,
          new SecretKeySpec(key, "AES"),
          new GCMParameterSpec(128, Base64.getDecoder().decode(parts[0])));
      c.updateAAD(owner.toString().getBytes(StandardCharsets.UTF_8));
      return new String(c.doFinal(Base64.getDecoder().decode(parts[1])), StandardCharsets.UTF_8);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(
          "MFA key could not be decrypted; restore the original server key.", e);
    }
  }
}
