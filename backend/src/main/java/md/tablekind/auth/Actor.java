package md.tablekind.auth;

import java.util.UUID;
import md.tablekind.common.Problem;
import org.springframework.security.oauth2.jwt.Jwt;

public record Actor(UUID id, String kind, int tokenVersion) {
  public static Actor from(Jwt jwt) {
    if (jwt == null) throw new Problem(401, "UNAUTHENTICATED", "Sign in or join a table first.");
    return new Actor(
        UUID.fromString(jwt.getSubject()),
        jwt.getClaimAsString("kind"),
        ((Number) jwt.getClaim("version")).intValue());
  }

  public boolean guest() {
    return "GUEST".equals(kind);
  }

  public boolean staff() {
    return "STAFF".equals(kind);
  }

  public boolean customer() { return "CUSTOMER".equals(kind); }

  public boolean platform() { return "PLATFORM".equals(kind); }

  public String scope() {
    return kind + ":" + id;
  }
}
