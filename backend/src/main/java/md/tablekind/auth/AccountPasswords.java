package md.tablekind.auth;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HexFormat;
import md.tablekind.common.Problem;

public final class AccountPasswords {
  private static final SecureRandom RANDOM = new SecureRandom();
  private AccountPasswords() {}

  public static void validate(String password) {
    if (password == null || password.length() < 12
        || password.getBytes(StandardCharsets.UTF_8).length > 72)
      throw Problem.bad("Use a password of at least 12 characters and at most 72 UTF-8 bytes.");
  }

  public static String recoveryCode() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return HexFormat.of().formatHex(bytes);
  }
}
