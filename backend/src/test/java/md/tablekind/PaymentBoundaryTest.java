package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.billing.Ledger;
import md.tablekind.common.*;
import md.tablekind.payments.*;
import md.tablekind.session.Sessions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.oauth2.jwt.Jwt;

class PaymentBoundaryTest {
  private final Db db = mock(Db.class);
  private final Access access = mock(Access.class);
  private final Sessions sessions = mock(Sessions.class);
  private final Ledger ledger = mock(Ledger.class);
  private final Payments payments = new Payments(db, access, sessions, ledger, new DisabledPaymentProvider());
  private final UUID sid = UUID.randomUUID(), id = UUID.randomUUID();
  private final Actor actor = new Actor(UUID.randomUUID(), "STAFF", 0);

  private void unavailable(Runnable action) {
    var problem = assertThrows(Problem.class, action::run);
    assertEquals(503, problem.status());
    assertEquals("PAYMENTS_UNCONFIGURED", problem.code());
    verifyNoInteractions(db, access, sessions, ledger);
  }

  @ParameterizedTest
  @ValueSource(strings = {"CASH", "TERMINAL", "CARD", "MIA"})
  void unconfiguredProfileCannotCreatePaymentsOfAnyMethod(String method) {
    unavailable(() -> payments.start(actor, sid,
        new PaymentController.Start(0, "SELF", List.of(), id, 100L, method, 0)));
  }

  @Test
  void unconfiguredProfileCannotChangeExistingPaymentsOrRefunds() {
    unavailable(() -> payments.confirm(actor, sid, id, new PaymentController.Confirm(0, 100L, "", true)));
    unavailable(() -> payments.cancel(actor, sid, id, 0));
    unavailable(() -> payments.reconcile(actor, sid, id, 0));
    unavailable(() -> payments.refund(actor, sid, id, new PaymentController.Refund(0, 100, 0, "REDUCE_BILL", "Fixture")));
    unavailable(() -> payments.confirmRefund(actor, sid, id, new PaymentController.RefundConfirm(0, "", true)));
    unavailable(() -> payments.cancelRefund(actor, sid, id, 0));
    unavailable(() -> payments.event(new PaymentProvider.Event(UUID.randomUUID(), id, UUID.randomUUID(), "PAYMENT", 100, "MDL", "SUCCEEDED"), "fixture"));
  }

  @Test
  void unconfiguredProfileChecksCapabilityBeforeCachedReceiptReplay() {
    var commands = mock(Commands.class);
    var controller = new PaymentController(payments, commands);
    var jwt = Jwt.withTokenValue("test-fixture").header("alg", "HS256")
        .subject(actor.id().toString()).claim("kind", "STAFF").claim("version", 0).build();
    unavailable(() -> controller.start(jwt, sid, UUID.randomUUID(),
        new PaymentController.Start(0, "SELF", List.of(), id, 100L, "CASH", 0)));
    unavailable(() -> controller.confirm(jwt, sid, id, UUID.randomUUID(),
        new PaymentController.Confirm(0, 100L, "", true)));
    verifyNoInteractions(commands);
  }
}
