package md.tablekind.customer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import md.tablekind.auth.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer")
public class CustomerController {
  private final Customers customers;
  private final RequestLimits limits;
  public CustomerController(Customers customers, RequestLimits limits) { this.customers=customers; this.limits=limits; }
  public record Register(@NotBlank @Pattern(regexp="[A-Za-z0-9_]{3,32}") String username,
      @NotBlank @Size(max=40) String displayName, @NotBlank @Size(min=12,max=72) String password,
      @NotNull @Pattern(regexp="en|ro|ru") String language,
      @Email @Size(max=254) String email) {}
  public record Login(@NotBlank @Size(max=40) String username, @NotBlank @Size(max=200) String password) {}
  public record Preferences(@NotBlank @Size(max=40) String displayName, @NotNull @Pattern(regexp="en|ro|ru") String language) {}
  public record Link(@NotBlank @Size(max=4096) String guestToken) {}
  public record Proof(@NotBlank @Size(max=200) String password) {}
  public record Password(@NotBlank @Size(max=200) String password, @NotBlank @Size(min=12,max=72) String newPassword) {}
  public record Recover(@NotBlank @Size(max=40) String username, @NotBlank @Pattern(regexp="[a-f0-9]{64}") String recoveryCode,
      @NotBlank @Size(min=12,max=72) String newPassword) {}
  private void limit(String name) { limits.check("customer-login:"+Customers.username(name), 10, 60); }
  @PostMapping("/register") public Object register(@Valid @RequestBody Register r) {
    limit(r.username());
    if (r.email()!=null) limits.check("email-recipient:"+r.email().trim().toLowerCase(java.util.Locale.ROOT),10,600);
    return customers.register(r);
  }
  @PostMapping("/login") public Object login(@Valid @RequestBody Login r) { limit(r.username()); return customers.login(r.username(),r.password()); }
  @PostMapping("/recover") public Object recover(@Valid @RequestBody Recover r) { limit(r.username()); return customers.recover(r.username(),r.recoveryCode(),r.newPassword()); }
  @GetMapping("/me") public Object me(@AuthenticationPrincipal Jwt jwt) { return customers.profile(Actor.from(jwt)); }
  @PutMapping("/preferences") public Object preferences(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Preferences r) { return customers.preferences(Actor.from(jwt),r); }
  @PostMapping("/table-link") public Object link(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Link r) { return customers.link(Actor.from(jwt),r.guestToken()); }
  @PostMapping("/visits/{guestId}/resume") public Object resume(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID guestId) { return customers.resume(Actor.from(jwt),guestId); }
  @PostMapping("/password") public Object password(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Password r) { return customers.password(Actor.from(jwt),r.password(),r.newPassword()); }
  @PostMapping("/recovery-code") public Object code(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Proof r) { return customers.recoveryCode(Actor.from(jwt),r.password()); }
  @PostMapping("/logout-all") public Object logout(@AuthenticationPrincipal Jwt jwt) { return customers.logoutAll(Actor.from(jwt)); }
  @PostMapping("/delete") public Object delete(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Proof r) { return customers.close(Actor.from(jwt),r.password()); }
}
