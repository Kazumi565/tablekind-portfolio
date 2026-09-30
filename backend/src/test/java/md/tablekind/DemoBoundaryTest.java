package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DemoBoundaryTest extends WorkflowSupport {
  @Test
  void practiceSetupIsUnavailableInOrdinaryLocalProfile() {
    var result = send(staff, "POST", "/api/demo/scenarios", Map.of(), UUID.randomUUID().toString());
    assertEquals(404, result.status());
  }
}
