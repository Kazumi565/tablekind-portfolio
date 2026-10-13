package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.UUID;
import md.tablekind.ai.SplitAiClient;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@TestPropertySource(properties = {
  "tablekind.ai.enabled=true",
  "tablekind.ai.api-key=fixture-only",
  "tablekind.ai.max-calls=100000"
})
class AiAvailabilityHttpTest extends WorkflowSupport {
  @MockitoBean SplitAiClient client;

  @Test
  void authenticatedStatusChecksConsumeNoCallsAndRespectTheDinersHourlyLimit() {
    item();
    long beforeCalls = db.number("SELECT count(*) FROM ai_usage");
    long beforeRevision = revision();
    String path = "/api/sessions/" + sid + "/ai-splits/status";
    assertEquals(401, send(null, "GET", path, null, null).status());
    assertEquals(403, send(staff, "GET", path, null, null).status());
    for (int n = 0; n < 3; n++) {
      var status = send(at, "GET", path, null, null);
      assertEquals(200, status.status());
      assertEquals("AVAILABLE", status.body().path("status").asText());
      assertEquals(1, status.body().size());
    }
    assertEquals(beforeCalls, db.number("SELECT count(*) FROM ai_usage"));
    assertEquals(beforeRevision, revision());
    assertEquals(10001, due(a));
    assertEquals(0, due(b));
    for (int n = 0; n < 20; n++)
      db.update("INSERT INTO ai_usage(id,guest_id,model,request_hash) VALUES(?,?,?,?)",
          UUID.randomUUID(), UUID.fromString(a), "fixture-only", "fixture-request-" + n);
    assertEquals("DINER_LIMIT_REACHED", send(at, "GET", path, null, null).body().path("status").asText());
    assertEquals("AVAILABLE", send(bt, "GET", path, null, null).body().path("status").asText());
    db.update("UPDATE ai_usage SET created_at=now()-interval '2 hours' WHERE guest_id=?", UUID.fromString(a));
    assertEquals("AVAILABLE", send(at, "GET", path, null, null).body().path("status").asText());
    assertEquals(beforeCalls + 20, db.number("SELECT count(*) FROM ai_usage"));
    assertEquals(beforeRevision, revision());
    verifyNoInteractions(client);
  }
}
