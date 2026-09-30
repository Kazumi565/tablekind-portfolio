package md.tablekind.auth;

import jakarta.servlet.http.*;
import java.util.UUID;
import md.tablekind.common.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

/** Re-check access before an idempotent response can be replayed after permission revocation. */
@Configuration
public class AuthorizationInterceptor implements WebMvcConfigurer {
  private final Access access;
  private final RequestLimits limits;

  public AuthorizationInterceptor(Access access, RequestLimits limits) {
    this.access = access;
    this.limits = limits;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry
        .addInterceptor(
            new HandlerInterceptor() {
              @Override
              public boolean preHandle(
                  HttpServletRequest req, HttpServletResponse res, Object handler) {
                String uri = req.getRequestURI();
                if (uri.startsWith("/api/auth/login")
                    || uri.startsWith("/api/customer")
                    || uri.startsWith("/api/platform/login")
                    || uri.startsWith("/api/join")
                    || uri.startsWith("/api/table-links"))
                  limits.check("public:" + req.getRemoteAddr(), 120, 60);
                var auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) return true;
                var actor = Actor.from(jwt);
                access.valid(actor);
                if (uri.startsWith("/api/platform/")) access.platform(actor);
                if (uri.startsWith("/api/customer/")) access.customer(actor);
                if (!req.getMethod().equals("GET")) limits.check("write:" + actor.scope(), 180, 60);
                String[] path = req.getRequestURI().split("/");
                if (path.length >= 4 && path[1].equals("api")) {
                  if (path[2].equals("restaurants")) {
                    UUID rid = UUID.fromString(path[3]);
                    access.staff(actor, rid);
                    boolean write = !req.getMethod().equals("GET");
                    boolean staffAction =
                        uri.endsWith("/availability") || uri.endsWith("/sessions");
                    if ((write && !staffAction)
                        || (path.length >= 5
                            && java.util.Set.of("onboarding", "audit", "pilot", "pos", "operations")
                                .contains(path[4]))) access.manager(actor, rid);
                  }
                  if (path[2].equals("sessions")) {
                    var session = access.session(actor, UUID.fromString(path[3]));
                    if (uri.endsWith("/payments/reconciliation"))
                      access.manager(actor, Db.id(session, "restaurant_id"));
                    if (req.getMethod().equals("POST") && path.length >= 5) {
                      if (path[4].equals("refunds")
                          || path[4].equals("adjustments")
                          || (path.length >= 7
                              && path[4].equals("payments")
                              && path[6].equals("refunds")))
                        access.manager(actor, Db.id(session, "restaurant_id"));
                      if (path.length >= 7
                          && path[4].equals("payments")
                          && path[6].equals("confirm"))
                        access.staff(actor, Db.id(session, "restaurant_id"));
                      if (java.util.Set.of("qr", "close").contains(path[4])
                          || (path[4].equals("guests") && uri.endsWith("/revoke"))
                          || (path[4].equals("help") && uri.endsWith("/complete")))
                        access.staff(actor, Db.id(session, "restaurant_id"));
                    }
                  }
                }
                return true;
              }
            })
        .addPathPatterns("/api/**");
  }
}
