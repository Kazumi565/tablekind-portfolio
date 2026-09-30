package md.tablekind.auth;

import java.time.Instant;
import java.util.*;
import md.tablekind.common.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountSecurity {
  private static final java.security.SecureRandom RECOVERY_RANDOM =
      new java.security.SecureRandom();
  private final Db db;
  private final SecretBox box;
  private final Access access;
  private final PasswordEncoder passwords;

  public AccountSecurity(Db db, SecretBox box, Access access, PasswordEncoder passwords) {
    this.db = db;
    this.box = box;
    this.access = access;
    this.passwords = passwords;
  }

  private Map<String, Object> account(Actor a, String password) {
    access.valid(a);
    if (!a.staff()) throw Problem.forbidden();
    var row = db.one("SELECT * FROM staff_account WHERE id=? FOR UPDATE", a.id());
    if (!Db.bool(row, "active") || Db.amount(row, "token_version") != a.tokenVersion())
      throw new Problem(401, "TOKEN_REVOKED", "Sign in again before changing account security.");
    if (!passwords.matches(password, Db.text(row, "password_hash")))
      throw new Problem(401, "LOGIN_FAILED", "The current password is incorrect.");
    return row;
  }

  public Object status(Actor a) {
    access.valid(a);
    if (!a.staff()) throw Problem.forbidden();
    return Map.of(
        "mfaEnabled",
        db.number(
                "SELECT count(*) FROM staff_account WHERE id=? AND mfa_secret IS NOT NULL", a.id())
            > 0,
        "recentEvents",
        db.list(
            "SELECT action,created_at FROM security_event WHERE staff_id=? ORDER BY id DESC LIMIT"
                + " 20",
            a.id()),
        "recoveryCodesRemaining",
        db.number("SELECT count(*) FROM auth_recovery_code WHERE staff_id=?", a.id()));
  }

  @Transactional
  public Object begin(Actor a, String password) {
    var row = account(a, password);
    if (row.get("mfa_secret") != null)
      throw Problem.conflict("Two-step sign-in is already enabled.");
    String secret = Totp.secret();
    db.update(
        "UPDATE staff_account SET mfa_pending=?,mfa_pending_until=now()+interval '10 minutes' WHERE"
            + " id=?",
        box.seal(a.id(), secret),
        a.id());
    return Map.of(
        "secret",
        secret,
        "uri",
        "otpauth://totp/Tablekind:"
            + java.net.URLEncoder.encode(
                Db.text(row, "email"), java.nio.charset.StandardCharsets.UTF_8)
            + "?secret="
            + secret
            + "&issuer=Tablekind&algorithm=SHA1&digits=6&period=30");
  }

  @Transactional
  public Object enable(Actor a, String password, String code) {
    var row = account(a, password);
    if (row.get("mfa_secret") != null
        || row.get("mfa_pending") == null
        || !Db.time(row, "mfa_pending_until").isAfter(Instant.now()))
      throw Problem.conflict("Start a new authenticator setup.");
    long step =
        Totp.match(
            box.open(a.id(), Db.text(row, "mfa_pending")),
            code,
            Instant.now().getEpochSecond(),
            -1);
    if (step < 0)
      throw new Problem(401, "MFA_INVALID", "Check the authenticator code and phone time.");
    db.update(
        "UPDATE staff_account SET"
            + " mfa_secret=mfa_pending,mfa_pending=NULL,mfa_pending_until=NULL,mfa_last_step=?,token_version=token_version+1"
            + " WHERE id=?",
        step,
        a.id());
    List<String> recovery = new ArrayList<>();
    db.update("DELETE FROM auth_recovery_code WHERE staff_id=?", a.id());
    for (int i = 0; i < 8; i++) {
      byte[] bytes = new byte[16];
      RECOVERY_RANDOM.nextBytes(bytes);
      String value = HexFormat.of().formatHex(bytes);
      recovery.add(value);
      db.update(
          "INSERT INTO auth_recovery_code(staff_id,code_hash) VALUES(?,?)",
          a.id(),
          Commands.hash(value));
    }
    audit(a.id(), "MFA_ENABLED");
    return Map.of("recoveryCodes", recovery, "signedOut", true);
  }

  /** Called with the staff row locked in the login transaction; consumed codes cannot replay. */
  public void verify(Map<String, Object> row, String code) {
    if (row.get("mfa_secret") == null) return;
    if (code == null || code.isBlank())
      throw new Problem(401, "MFA_REQUIRED", "Enter your authenticator code or a recovery code.");
    UUID id = Db.id(row, "id");
    long step =
        Totp.match(
            box.open(id, Db.text(row, "mfa_secret")),
            code,
            Instant.now().getEpochSecond(),
            Db.amount(row, "mfa_last_step"));
    if (step >= 0) {
      db.update("UPDATE staff_account SET mfa_last_step=? WHERE id=?", step, id);
      return;
    }
    if (code.matches("[a-f0-9]{32}")
        && db.update(
                "DELETE FROM auth_recovery_code WHERE staff_id=? AND code_hash=?",
                id,
                Commands.hash(code))
            == 1) {
      audit(id, "RECOVERY_CODE_USED");
      return;
    }
    throw new Problem(
        401,
        "MFA_INVALID",
        "Code invalid or already used. Wait for a fresh code or use a recovery code.");
  }

  @Transactional
  public Object disable(Actor a, String password, String code) {
    var row = account(a, password);
    verify(row, code);
    db.update(
        "UPDATE staff_account SET"
            + " mfa_secret=NULL,mfa_pending=NULL,mfa_pending_until=NULL,mfa_last_step=-1,token_version=token_version+1"
            + " WHERE id=?",
        a.id());
    db.update("DELETE FROM auth_recovery_code WHERE staff_id=?", a.id());
    audit(a.id(), "MFA_DISABLED");
    return Map.of("signedOut", true);
  }

  @Transactional
  public Object password(Actor a, String old, String next, String code) {
    var row = account(a, old);
    verify(row, code);
    if (next.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw Problem.bad("Use at most 72 UTF-8 bytes for the password.");
    db.update(
        "UPDATE staff_account SET"
            + " password_hash=?,token_version=token_version+1,mfa_pending=NULL,mfa_pending_until=NULL"
            + " WHERE id=?",
        passwords.encode(next),
        a.id());
    audit(a.id(), "PASSWORD_CHANGED");
    return Map.of("signedOut", true);
  }

  public void audit(UUID id, String action) {
    db.update("INSERT INTO security_event(staff_id,action) VALUES(?,?)", id, action);
  }
}
