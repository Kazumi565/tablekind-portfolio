package md.tablekind.auth;

import java.nio.ByteBuffer;
import java.security.*;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** RFC 6238: SHA-1, 30-second time step, six digits. */
public final class Totp {
  private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  private Totp() {}

  public static String secret() {
    byte[] bytes = new byte[20];
    new SecureRandom().nextBytes(bytes);
    StringBuilder result = new StringBuilder();
    int buffer = 0, bits = 0;
    for (byte b : bytes) {
      buffer = (buffer << 8) | (b & 255);
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        result.append(ALPHABET.charAt((buffer >> bits) & 31));
      }
    }
    return result.toString();
  }

  public static String code(String secret, long step) {
    byte[] bytes = new byte[secret.length() * 5 / 8];
    int buffer = 0, bits = 0, index = 0;
    for (char c : secret.toCharArray()) {
      int digit = ALPHABET.indexOf(c);
      if (digit < 0) throw new IllegalArgumentException();
      buffer = (buffer << 5) | digit;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes[index++] = (byte) (buffer >> bits);
      }
    }
    try {
      Mac mac = Mac.getInstance("HmacSHA1");
      mac.init(new SecretKeySpec(bytes, "HmacSHA1"));
      byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
      int o = hash[hash.length - 1] & 15;
      int value =
          ((hash[o] & 127) << 24)
              | ((hash[o + 1] & 255) << 16)
              | ((hash[o + 2] & 255) << 8)
              | (hash[o + 3] & 255);
      return String.format(Locale.ROOT, "%06d", value % 1000000);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  public static long match(String secret, String value, long now, long last) {
    if (value == null || !value.matches("[0-9]{6}")) return -1;
    for (long step = now / 30 - 1; step <= now / 30 + 1; step++)
      if (step > last
          && MessageDigest.isEqual(
              code(secret, step).getBytes(java.nio.charset.StandardCharsets.US_ASCII),
              value.getBytes(java.nio.charset.StandardCharsets.US_ASCII))) return step;
    return -1;
  }
}
