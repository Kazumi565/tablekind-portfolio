package md.tablekind.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/platform")
public class PlatformController {
  private final PlatformService service;private final RequestLimits limits;
  public PlatformController(PlatformService service,RequestLimits limits) {this.service=service;this.limits=limits;}
  public record Login(@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(max=200) String password,@NotBlank @Size(max=64) String code) {}
  public record Proof(@NotBlank @Size(max=200) String password,@NotBlank @Size(max=64) String code) {}
  public record Create(@NotBlank @Size(max=120) String name,@NotBlank @Email @Size(max=254) String ownerEmail,
      @NotBlank @Size(max=80) String ownerName,@NotBlank @Size(min=12,max=72) String ownerPassword,
      @NotBlank @Size(max=400) String reason,@Valid @NotNull Proof proof) {}
  public record Assign(@NotBlank @Email @Size(max=254) String ownerEmail,@NotBlank @Size(max=400) String reason,@Valid @NotNull Proof proof) {}
  public record CurrentPassword(@NotBlank @Size(max=200) String password) {}
  public record Security(@NotBlank @Size(min=12,max=72) String newPassword,@NotBlank @Pattern(regexp="[0-9]{6}") String newCode,@NotBlank @Size(max=200) String password) {}
  @PostMapping("/login") public Object login(@Valid @RequestBody Login r) {
    limits.check("platform-login:"+r.email().trim().toLowerCase(Locale.ROOT),5,60);return service.login(r);
  }
  @GetMapping("/overview") public Object overview(@AuthenticationPrincipal Jwt jwt) {return service.overview(Actor.from(jwt));}
  private Actor actor(Jwt jwt) {var a=Actor.from(jwt);limits.check("platform-proof:"+a.id(),10,60);return a;}
  @PostMapping("/restaurants") public Object create(@AuthenticationPrincipal Jwt jwt,@RequestHeader("Idempotency-Key") UUID key,@Valid @RequestBody Create r) {return service.create(actor(jwt),key,r);}
  @PostMapping("/restaurants/{rid}/owner") public Object assign(@AuthenticationPrincipal Jwt jwt,@RequestHeader("Idempotency-Key") UUID key,@PathVariable UUID rid,@Valid @RequestBody Assign r) {return service.assign(actor(jwt),key,rid,r);}
  private Actor recent(Jwt jwt) {
    if(jwt.getIssuedAt()==null || jwt.getIssuedAt().plusSeconds(300).isBefore(java.time.Instant.now()))
      throw new md.tablekind.common.Problem(401,"RECENT_LOGIN_REQUIRED","Sign in again with your authenticator or recovery code before replacing administrator security.");
    return actor(jwt);
  }
  @PostMapping("/security") public Object security(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Security r) {return service.security(recent(jwt),r);}
  @PostMapping("/security/setup") public Object setup(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody CurrentPassword r) {return service.beginSecurity(recent(jwt),r);}
  @PostMapping("/logout") public Object logout(@AuthenticationPrincipal Jwt jwt) {return service.logout(Actor.from(jwt));}
}
