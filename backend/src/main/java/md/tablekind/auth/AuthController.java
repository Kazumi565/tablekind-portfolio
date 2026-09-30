package md.tablekind.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import md.tablekind.common.Db;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  private final Access access;
  private final Db db;
  private final AccountSecurity security;
  private final RequestLimits limits;

  public AuthController(
      AuthService auth, Access access, Db db, AccountSecurity security, RequestLimits limits) {
    this.auth = auth;
    this.access = access;
    this.db = db;
    this.security = security;
    this.limits = limits;
  }

  public record Login(
      @Email @NotBlank @Size(max = 254) String email,
      @NotBlank @Size(max = 200) String password,
      @Size(max = 64) String code) {}

  @PostMapping("/login")
  public Object login(@Valid @RequestBody Login request) {
    limits.check("login:" + request.email().trim().toLowerCase(java.util.Locale.ROOT), 10, 60);
    return auth.login(request.email(), request.password(), request.code());
  }

  public record Proof(@NotBlank @Size(max = 200) String password, @Size(max = 64) String code) {}

  public record PasswordChange(
      @NotBlank @Size(max = 200) String password,
      @NotBlank @Size(min = 12, max = 72) String newPassword,
      @Size(max = 64) String code) {}

  @GetMapping("/security")
  public Object security(@AuthenticationPrincipal Jwt jwt) {
    return security.status(Actor.from(jwt));
  }

  @PostMapping("/mfa/setup")
  public Object setup(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Proof r) {
    var a = Actor.from(jwt);
    limits.check("security:" + a.id(), 10, 60);
    return security.begin(a, r.password());
  }

  @PostMapping("/mfa/enable")
  public Object enable(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Proof r) {
    var a = Actor.from(jwt);
    limits.check("security:" + a.id(), 10, 60);
    return security.enable(a, r.password(), r.code());
  }

  @PostMapping("/mfa/disable")
  public Object disable(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Proof r) {
    var a = Actor.from(jwt);
    limits.check("security:" + a.id(), 10, 60);
    return security.disable(a, r.password(), r.code());
  }

  @PostMapping("/password")
  public Object password(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PasswordChange r) {
    var a = Actor.from(jwt);
    limits.check("security:" + a.id(), 10, 60);
    return security.password(a, r.password(), r.newPassword(), r.code());
  }

  @GetMapping("/me")
  public Object me(@AuthenticationPrincipal Jwt jwt) {
    Actor a = Actor.from(jwt);
    if (!a.staff() && !a.guest()) throw md.tablekind.common.Problem.forbidden();
    access.valid(a);
    if (a.staff())
      return Map.of(
          "id",
          a.id(),
          "kind",
          "STAFF",
          "memberships",
          db.list(
              "SELECT m.restaurant_id,m.role,r.name FROM membership m JOIN restaurant r ON"
                  + " r.id=m.restaurant_id WHERE m.staff_id=? ORDER BY r.name",
              a.id()));
    return db.one("SELECT id,session_id,nickname,'GUEST' AS kind FROM guest WHERE id=?", a.id());
  }

  @PostMapping("/logout-all")
  public Object logout(@AuthenticationPrincipal Jwt jwt) {
    Actor a = Actor.from(jwt);
    if (!a.staff() && !a.guest()) throw md.tablekind.common.Problem.forbidden();
    access.valid(a);
    db.update(
        a.staff()
            ? "UPDATE staff_account SET token_version=token_version+1 WHERE id=?"
            : "UPDATE guest SET token_version=token_version+1 WHERE id=?",
        a.id());
    if (a.staff()) security.audit(a.id(), "ALL_SESSIONS_REVOKED");
    return Map.of("signedOut", true);
  }
}
