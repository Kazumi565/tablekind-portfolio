package md.tablekind.ai;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface SplitAiClient {
  record Share(UUID guestId, long weight) {}

  record Allocation(UUID itemId, String mode, List<Share> shares) {}

  record Interpretation(
      String status, String question, String summary, List<Allocation> allocations) {}

  Interpretation interpret(String instruction, Map<String, Object> snapshot);
}
