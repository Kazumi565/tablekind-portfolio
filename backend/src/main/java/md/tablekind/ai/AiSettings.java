package md.tablekind.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public record AiSettings(
    @Value("${tablekind.ai.enabled:false}") boolean enabled,
    @Value("${tablekind.ai.api-key:}") String apiKey,
    @Value("${tablekind.ai.model:gpt-6-luna}") String model,
    @Value("${tablekind.ai.reasoning-effort:low}") String reasoningEffort,
    @Value("${tablekind.ai.max-calls:0}") int maxCalls) {
  public boolean configured() {
    return enabled && !apiKey.isBlank() && maxCalls > 0;
  }

  @Override
  public String toString() {
    return "AiSettings[credentials redacted]";
  }
}
