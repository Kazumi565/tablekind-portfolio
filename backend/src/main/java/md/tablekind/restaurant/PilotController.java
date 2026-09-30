package md.tablekind.restaurant;

import java.util.UUID;
import md.tablekind.auth.Actor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/restaurants/{rid}/pilot")
public class PilotController {
  private final PilotMetrics metrics;
  public PilotController(PilotMetrics metrics) { this.metrics = metrics; }

  @GetMapping
  public Object report(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid,
      @RequestParam(defaultValue = "30") int days) {
    return metrics.report(Actor.from(jwt), rid, days);
  }
}
