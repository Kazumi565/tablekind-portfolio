package md.tablekind.auth;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import md.tablekind.common.Db;
import md.tablekind.common.Problem;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final Db db;
  private final PasswordEncoder passwords;
  private final JwtEncoder encoder;
  private final String dummyHash;
  private final AccountSecurity security;

  public AuthService(
      Db db, PasswordEncoder passwords, JwtEncoder encoder, AccountSecurity security) {
    this.db = db;
    this.passwords = passwords;
    this.encoder = encoder;
    this.security = security;
    dummyHash = passwords.encode(UUID.randomUUID().toString());
  }

  @org.springframework.transaction.annotation.Transactional(noRollbackFor = Problem.class)
  public Map<String, Object> login(String email, String password, String code) {
    var row =
        db.optional(
            "SELECT * FROM staff_account WHERE email=? FOR UPDATE",
            email.toLowerCase(Locale.ROOT).trim());
    boolean matches =
        passwords.matches(password, row.map(r -> Db.text(r, "password_hash")).orElse(dummyHash));
    if (row.isEmpty() || !matches || !Db.bool(row.get(), "active")) {
      security.audit(row.map(r -> Db.id(r, "id")).orElse(null), "LOGIN_FAILED");
      throw new Problem(401, "LOGIN_FAILED", "Email or password is incorrect.");
    }
    try {
      security.verify(row.get(), code);
    } catch (Problem e) {
      security.audit(Db.id(row.get(), "id"), "MFA_LOGIN_FAILED");
      throw e;
    }
    security.audit(Db.id(row.get(), "id"), "LOGIN_SUCCEEDED");
    return token(Db.id(row.get(), "id"), "STAFF", (int) Db.amount(row.get(), "token_version"));
  }

  public Map<String, Object> token(UUID id, String kind, int version) {
    Instant now = Instant.now(),
        expires = kind.equals("PLATFORM") ? now.plus(30, ChronoUnit.MINUTES)
            : now.plus(kind.equals("STAFF") ? 8 : 24, ChronoUnit.HOURS);
    var claims =
        JwtClaimsSet.builder()
            .issuer("tablekind-local")
            .subject(id.toString())
            .issuedAt(now)
            .expiresAt(expires)
            .claim("kind", kind)
            .claim("version", version)
            .build();
    String token =
        encoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
    return Map.of(
        "accessToken", token, "expiresAt", expires.toString(), "actorId", id, "kind", kind);
  }
}
