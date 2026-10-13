package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import md.tablekind.ai.AiAvailability;
import md.tablekind.ai.AiAvailability.Status;
import md.tablekind.ai.AiSettings;
import md.tablekind.auth.Access;
import md.tablekind.auth.Actor;
import md.tablekind.common.Db;
import md.tablekind.common.Problem;
import org.junit.jupiter.api.Test;

class AiAvailabilityTest {
  final Db db = mock(Db.class);
  final Access access = mock(Access.class);
  final Actor actor = new Actor(UUID.randomUUID(), "GUEST", 0);
  final UUID session = UUID.randomUUID();

  AiAvailability availability(boolean enabled, String key, int cap) {
    return new AiAvailability(access, new AiSettings(enabled, key, "private-model", "low", cap), db);
  }

  @Test
  void disabledAndUnconfiguredDoNotReadOrWriteUsage() {
    assertEquals(Status.DISABLED, availability(false, "private-key", 5).status(actor, session).status());
    assertEquals(Status.UNCONFIGURED, availability(true, "", 5).status(actor, session).status());
    verify(access, times(2)).guest(actor, session);
    verifyNoInteractions(db);
  }

  @Test
  void zeroAllowanceBlocksWithoutTouchingUsage() {
    assertEquals(Status.ALLOWANCE_REACHED, availability(true, "private-key", 0).status(actor, session).status());
    verifyNoInteractions(db);
  }

  @Test
  void durableCumulativeAllowanceIncludesUncompletedRequests() {
    when(db.number("SELECT count(*) FROM ai_usage")).thenReturn(7L);
    assertEquals(Status.ALLOWANCE_REACHED, availability(true, "private-key", 7).status(actor, session).status());
    verify(db).number("SELECT count(*) FROM ai_usage");
    verifyNoMoreInteractions(db);
  }

  @Test
  void dinerLimitAndAvailabilityUseTheSameHourlyWindowAsPreview() {
    String sql = "SELECT count(*) FROM ai_usage WHERE guest_id=? AND created_at>now()-interval '1 hour'";
    when(db.number(sql, actor.id())).thenReturn(20L, 19L);
    var service = availability(true, "private-key", 100);
    assertEquals(Status.DINER_LIMIT_REACHED, service.status(actor, session).status());
    assertEquals(Status.AVAILABLE, service.status(actor, session).status());
  }

  @Test
  void authorizationPrecedesConfigurationAndUsageChecks() {
    doThrow(Problem.forbidden()).when(access).guest(actor, session);
    assertThrows(Problem.class, () -> availability(false, "private-key", 7).status(actor, session));
    verifyNoInteractions(db);
  }

  @Test
  void responseContainsOnlyThePublicStatus() throws Exception {
    String response = new ObjectMapper().writeValueAsString(availability(true, "private-key", 7).status(actor, session));
    assertEquals("{\"status\":\"AVAILABLE\"}", response);
  }
}
