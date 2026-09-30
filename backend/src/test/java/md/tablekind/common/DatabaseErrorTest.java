package md.tablekind.common;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.CannotCreateTransactionException;

class DatabaseErrorTest {
  @Test
  void unavailableDatabaseDoesNotLeakConnectionDetailsOrClaimFailure() {
    var r =
        new Errors(null)
            .databaseUnavailable(new CannotCreateTransactionException("secret connection data"));
    assertEquals(503, r.getStatusCode().value());
    assertEquals("5", r.getHeaders().getFirst("Retry-After"));
    assertTrue(r.getBody().toString().contains("retry the same request"));
    assertFalse(r.getBody().toString().contains("secret connection data"));
  }
}
