package md.tablekind.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public record AiSettings(
    @Value("${tablekind.ai.enabled:false}") boolean enabled,
    @Value("${tablekind.ai.api-key:}") String apiKey,
    @Value("${tablekind.ai.model:gpt-4.1-mini-2025-04-14}") String model,
    @Value("${tablekind.ai.max-calls:0}") int maxCalls) {
  public boolean configured() {
    return enabled && !apiKey.isBlank() && maxCalls > 0;
  }

  @Override
  public String toString() {
    return "AiSettings[credentials redacted]";
  }
}
