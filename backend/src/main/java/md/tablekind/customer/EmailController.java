package md.tablekind.customer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import md.tablekind.auth.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/email")
public class EmailController {
  private final CustomerEmail email;
  private final EmailSettings settings;
  private final RequestLimits limits;
  public EmailController(CustomerEmail email,EmailSettings settings,RequestLimits limits) {
    this.email=email;this.settings=settings;this.limits=limits;
  }
  public record Address(@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(max=200) String password) {}
  public record Code(@NotBlank @Pattern(regexp="[0-9]{8}") String code) {}
  public record ResetRequest(@NotBlank @Size(max=40) String username,@NotBlank @Email @Size(max=254) String email) {}
  public record Reset(@NotBlank @Size(max=40) String username,@NotBlank @Email @Size(max=254) String email,
      @NotBlank @Pattern(regexp="[0-9]{8}") String code,@NotBlank @Size(min=12,max=72) String newPassword) {}
  private void limit(String name,String recipient) {
    limits.check("email-account:"+Customers.username(name),10,600);
    limits.check("email-recipient:"+recipient.trim().toLowerCase(java.util.Locale.ROOT),10,600);
  }
  @GetMapping("/config") public Object config() { return settings.publicConfig(); }
  @PostMapping("/request") public Object request(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Address r) {
    Actor a=Actor.from(jwt);limit(a.id().toString(),r.email());return email.request(a,r.email(),r.password());
  }
  @PostMapping("/resend") public Object resend(@AuthenticationPrincipal Jwt jwt) {
    Actor a=Actor.from(jwt);limits.check("email-resend:"+a.id(),10,600);return email.resend(a);
  }
  @PostMapping("/verify") public Object verify(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Code r) {
    Actor a=Actor.from(jwt);limits.check("email-verify:"+a.id(),20,600);return email.verify(a,r.code());
  }
  @PostMapping("/reset/request") public Object requestReset(@Valid @RequestBody ResetRequest r) {
    limit(r.username(),r.email());return email.requestReset(r.username(),r.email());
  }
  @PostMapping("/reset/confirm") public Object reset(@Valid @RequestBody Reset r) {
    limit(r.username(),r.email());return email.reset(r.username(),r.email(),r.code(),r.newPassword());
  }
}
