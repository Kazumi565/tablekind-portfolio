package md.tablekind.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import md.tablekind.auth.Actor;
import md.tablekind.common.Commands;
import md.tablekind.session.SessionController.Revision;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sid}/ai-splits")
public class AiSplitController {
  private final AiSplits splits;
  private final Commands commands;

  public AiSplitController(AiSplits splits, Commands commands) {
    this.splits = splits;
    this.commands = commands;
  }

  public record Prompt(@Min(0) long revision, @NotBlank @Size(max = 2000) String instruction) {}

  @PostMapping("/preview")
  public Object preview(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Prompt r) {
    return splits.preview(Actor.from(jwt), sid, key, r.revision(), r.instruction());
  }

  @PostMapping("/{draft}/confirm")
  public Object confirm(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID sid,
      @PathVariable UUID draft,
      @RequestHeader("Idempotency-Key") UUID key,
      @Valid @RequestBody Revision r) {
    var a = Actor.from(jwt);
    splits.authorize(a, sid);
    return commands.run(
        a.scope(),
        key,
        "ai-confirm:" + sid + ":" + draft,
        r,
        () -> splits.confirm(a, sid, draft, r.revision()));
  }
}
