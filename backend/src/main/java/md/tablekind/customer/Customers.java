package md.tablekind.customer;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Customers {
  private final Db db;
  private final Access access;
  private final AuthService auth;
  private final PasswordEncoder passwords;
  private final JwtDecoder decoder;
  private final CustomerEmail email;
  private final EmailSettings emailSettings;
  private final String dummy;

  public Customers(Db db, Access access, AuthService auth, PasswordEncoder passwords, JwtDecoder decoder,
      CustomerEmail email, EmailSettings emailSettings) {
    this.db = db; this.access = access; this.auth = auth; this.passwords = passwords; this.decoder = decoder;
    this.email=email; this.emailSettings=emailSettings;
    dummy = passwords.encode(UUID.randomUUID().toString());
  }

  public static String username(String value) { return value.trim().toLowerCase(Locale.ROOT); }

  @Transactional
  public Object register(CustomerController.Register r) {
    AccountPasswords.validate(r.password());
    UUID id = UUID.randomUUID();
    String recovery = AccountPasswords.recoveryCode();
    if (db.update("INSERT INTO customer_account(id,username,display_name,language,password_hash,recovery_hash)"
        + " VALUES(?,?,?,?,?,?) ON CONFLICT(username) DO NOTHING", id, username(r.username()),
        r.displayName().trim(), r.language(), passwords.encode(r.password()), Commands.hash(recovery)) != 1)
      throw Problem.conflict("That username is unavailable. If you already registered, sign in.");
    audit(id, "REGISTERED");
    email.registration(id,r.email());
    var result = new LinkedHashMap<String, Object>(auth.token(id, "CUSTOMER", 0));
    result.put("recoveryCode", recovery);
    return result;
  }

  @Transactional
  public Object login(String username, String password) {
    var row = db.optional("SELECT * FROM customer_account WHERE username=? FOR UPDATE", username(username));
    boolean matches = passwords.matches(password, row.map(r -> Db.text(r, "password_hash")).orElse(dummy));
    if (row.isEmpty() || !matches || !Db.bool(row.get(), "active"))
      throw new Problem(401, "LOGIN_FAILED", "Username or password is incorrect.");
    audit(Db.id(row.get(), "id"), "LOGIN_SUCCEEDED");
    return auth.token(Db.id(row.get(), "id"), "CUSTOMER", (int) Db.amount(row.get(), "token_version"));
  }

  private Map<String, Object> account(Actor a) {
    access.customer(a);
    var row = db.one("SELECT * FROM customer_account WHERE id=? FOR UPDATE", a.id());
    access.customer(a);
    return row;
  }

  private void proof(Map<String, Object> row, String password) {
    if (!passwords.matches(password, Db.text(row, "password_hash")))
      throw new Problem(401, "PASSWORD_INCORRECT", "The current password is incorrect.");
  }

  public Object profile(Actor a) {
    access.customer(a);
    return Map.of("profile", db.one("SELECT id,username,display_name,language,created_at,email,pending_email,email_verified_at,email_verification_mode FROM customer_account WHERE id=?", a.id()),
        "emailSettings",emailSettings.publicConfig(),
        "emailDelivery",db.list("SELECT purpose,delivery_status,expires_at,created_at FROM customer_email_challenge WHERE customer_id=? AND consumed_at IS NULL ORDER BY created_at DESC",a.id()),
        "visits", db.list("SELECT g.id AS guest_id,g.session_id,g.nickname,g.active,s.status,r.name AS restaurant_name,"
            + "t.label,g.joined_at,coalesce((SELECT sum(amount_bani) FROM allocation_entry WHERE guest_id=g.id),0) AS allocated_bani,"
            + "coalesce((SELECT sum(amount_bani) FROM settlement_entry WHERE guest_id=g.id),0) AS settled_bani"
            + " FROM guest g JOIN table_session s ON s.id=g.session_id JOIN restaurant r ON r.id=g.restaurant_id"
            + " JOIN dining_table t ON t.id=s.table_id WHERE g.customer_id=? ORDER BY g.joined_at DESC,g.id LIMIT 100", a.id()));
  }

  @Transactional
  public Object preferences(Actor a, CustomerController.Preferences r) {
    account(a);
    db.update("UPDATE customer_account SET display_name=?,language=? WHERE id=?", r.displayName().trim(), r.language(), a.id());
    return Map.of("saved", true);
  }

  @Transactional
  public Object link(Actor a, String guestToken) {
    email.requireVerified(account(a));
    Actor guest;
    try { guest = Actor.from(decoder.decode(guestToken)); }
    catch (JwtException | IllegalArgumentException e) { throw new Problem(401, "GUEST_ACCESS_INVALID", "Join the table again before linking it."); }
    if (!guest.guest()) throw Problem.forbidden();
    access.valid(guest);
    var row = db.one("SELECT session_id FROM guest WHERE id=?", guest.id());
    requireOpen(Db.id(row, "session_id"));
    row = db.one("SELECT * FROM guest WHERE id=? FOR UPDATE", guest.id());
    access.valid(guest);
    if (row.get("customer_id") != null && !a.id().equals(Db.id(row, "customer_id")))
      throw Problem.conflict("This table guest is already linked to another account.");
    if (db.number("SELECT count(*) FROM guest WHERE customer_id=? AND session_id=? AND id<>?",
        a.id(), Db.id(row, "session_id"), guest.id()) > 0)
      throw Problem.conflict("You already linked a guest at this table. Resume that guest instead.");
    if (row.get("customer_id") == null) {
      db.update("UPDATE guest SET customer_id=? WHERE id=?", a.id(), guest.id());
      audit(a.id(), "TABLE_LINKED");
    }
    return Map.of("linked", true, "guestId", guest.id());
  }

  @Transactional
  public Object resume(Actor a, UUID guestId) {
    email.requireVerified(account(a));
    var row = db.optional("SELECT * FROM guest WHERE id=? AND customer_id=? AND active", guestId, a.id())
        .orElseThrow(Problem::forbidden);
    requireOpen(Db.id(row, "session_id"));
    row = db.one("SELECT * FROM guest WHERE id=? FOR UPDATE", guestId);
    if (!Db.bool(row, "active")) throw Problem.forbidden();
    var result = new LinkedHashMap<String, Object>(auth.token(guestId, "GUEST", (int) Db.amount(row, "token_version")));
    result.put("sessionId", Db.id(row, "session_id"));
    audit(a.id(), "TABLE_RESUMED");
    return result;
  }

  private void requireOpen(UUID sid) {
    var s = db.one("SELECT status FROM table_session WHERE id=? FOR UPDATE", sid);
    if (!Db.text(s, "status").equals("OPEN")) throw Problem.conflict("This table is closed. Your visit remains in your history.");
  }

  private void revoke(UUID id) {
    email.invalidate(id);
    db.update("UPDATE customer_account SET pending_email=NULL WHERE id=?",id);
    db.update("UPDATE customer_account SET token_version=token_version+1 WHERE id=?", id);
    db.update("UPDATE guest SET token_version=token_version+1 WHERE customer_id=?", id);
  }

  @Transactional
  public Object password(Actor a, String old, String next) {
    var row = account(a); proof(row, old); AccountPasswords.validate(next);
    db.update("UPDATE customer_account SET password_hash=? WHERE id=?", passwords.encode(next), a.id());
    revoke(a.id()); audit(a.id(), "PASSWORD_CHANGED");
    return Map.of("signedOut", true);
  }

  @Transactional
  public Object recoveryCode(Actor a, String password) {
    proof(account(a), password);
    String code = AccountPasswords.recoveryCode();
    db.update("UPDATE customer_account SET recovery_hash=? WHERE id=?", Commands.hash(code), a.id());
    audit(a.id(), "RECOVERY_CODE_REPLACED");
    return Map.of("recoveryCode", code);
  }

  @Transactional
  public Object recover(String name, String code, String password) {
    AccountPasswords.validate(password);
    var row = db.optional("SELECT * FROM customer_account WHERE username=? AND active FOR UPDATE", username(name));
    if (row.isEmpty() || !java.security.MessageDigest.isEqual(Commands.hash(code).getBytes(java.nio.charset.StandardCharsets.UTF_8),
        Db.text(row.get(), "recovery_hash").getBytes(java.nio.charset.StandardCharsets.UTF_8)))
      throw new Problem(401, "RECOVERY_FAILED", "Username or recovery code is incorrect.");
    UUID id = Db.id(row.get(), "id");
    String next = AccountPasswords.recoveryCode();
    db.update("UPDATE customer_account SET password_hash=?,recovery_hash=? WHERE id=?", passwords.encode(password), Commands.hash(next), id);
    revoke(id); audit(id, "ACCOUNT_RECOVERED");
    return Map.of("recoveryCode", next, "signedOut", true);
  }

  @Transactional
  public Object logoutAll(Actor a) {
    account(a); revoke(a.id()); audit(a.id(), "ALL_SESSIONS_REVOKED");
    return Map.of("signedOut", true);
  }

  @Transactional
  public Object close(Actor a, String password) {
    proof(account(a), password);
    if (db.number("SELECT count(*) FROM guest g JOIN table_session s ON s.id=g.session_id WHERE g.customer_id=? AND s.status='OPEN'", a.id()) > 0)
      throw Problem.conflict("Ask staff to close your linked tables before deleting the account.");
    revoke(a.id());
    db.update("UPDATE guest SET customer_id=NULL WHERE customer_id=?", a.id());
    db.update("UPDATE customer_account SET active=false,username=?,display_name='Deleted account',password_hash='',recovery_hash='',language='en',email=NULL,pending_email=NULL,email_verified_at=NULL,email_verification_mode=NULL WHERE id=?",
        "deleted-" + a.id().toString().replace("-", ""), a.id());
    audit(a.id(), "ACCOUNT_DELETED");
    return Map.of("signedOut", true);
  }

  private void audit(UUID id, String action) {
    db.update("INSERT INTO customer_security_event(customer_id,action) VALUES(?,?)", id, action);
  }
}
