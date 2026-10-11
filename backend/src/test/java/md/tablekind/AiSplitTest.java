package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import md.tablekind.ai.*;
import md.tablekind.ai.SplitAiClient.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@TestPropertySource(
    properties = {
      "tablekind.ai.enabled=true",
      "tablekind.ai.api-key=fixture-only",
      "tablekind.ai.max-calls=100000"
    })
class AiSplitTest extends WorkflowSupport {
  @MockitoBean SplitAiClient client;

  Share share(String id, long weight) {
    return new Share(UUID.fromString(id), weight);
  }

  Allocation equal(String item) {
    return new Allocation(UUID.fromString(item), "EQUAL", List.of(share(a, 1), share(b, 1)));
  }

  Interpretation ready(Allocation... items) {
    return new Interpretation("READY", "", "Share the selected dishes equally", List.of(items));
  }

  com.fasterxml.jackson.databind.JsonNode preview(String text) {
    return action(at, "/ai-splits/preview", "instruction", text);
  }

  String confirm(com.fasterxml.jackson.databind.JsonNode p) {
    return action(at, "/ai-splits/" + p.path("draftId").asText() + "/confirm")
        .path("proposalId")
        .asText();
  }

  long proposals() {
    return db.number(
        "SELECT count(*) FROM allocation_proposal WHERE session_id=?", UUID.fromString(sid));
  }

  @Test
  void exactAtomicMultiItemPreviewNeedsEveryAffectedDinersConsent() {
    String i1 = item(), i2 = item();
    when(client.interpret(anyString(), anyMap()))
        .thenAnswer(
            c -> {
              assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
              var snapshot = (Map<?, ?>) c.getArgument(1);
              assertEquals(2, ((List<?>) snapshot.get("items")).size());
              return ready(equal(i1), equal(i2));
            });
    var p = preview("Share I1 and I2 equally with Diego");
    assertEquals("READY", p.path("status").asText(), p.toString());
    assertEquals(20002, due(a));
    assertEquals(0, due(b));
    assertEquals(0, proposals());
    assertEquals(2, p.path("requiredGuestIds").size());
    for (var i : p.path("items"))
      assertEquals(
          10001,
          i.path("shares").get(0).path("amountMinor").asLong()
              + i.path("shares").get(1).path("amountMinor").asLong());
    String proposal = confirm(p);
    assertEquals(20002, due(a));
    action(bt, "/proposals/" + proposal + "/vote", "accept", true);
    assertEquals(20002, due(a) + due(b));
    assertTrue(Math.abs(due(a) - due(b)) <= 2);
    assertEquals("ACCEPTED", state().path("proposals").get(0).path("status").asText());
  }

  @Test
  void rejectionAndWithdrawalPreserveOriginalAmounts() {
    String item = item();
    when(client.interpret(anyString(), anyMap())).thenReturn(ready(equal(item)));
    String proposal = confirm(preview("Share I1 equally"));
    action(bt, "/proposals/" + proposal + "/vote", "accept", false);
    assertEquals(10001, due(a));
    assertEquals(0, due(b));
    String next = confirm(preview("Share I1 equally"));
    action(at, "/proposals/" + next + "/withdraw");
    assertEquals(10001, due(a));
    assertEquals(0, due(b));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "invented-item",
        "invented-guest",
        "negative",
        "duplicate-guest",
        "duplicate-item",
        "unknown-mode",
        "empty",
        "question"
      })
  void invalidInterpretationsNeverCreateDraftOrProposal(String kind) {
    String item = item();
    Allocation valid = equal(item);
    Interpretation output =
        switch (kind) {
          case "invented-item" -> ready(equal(UUID.randomUUID().toString()));
          case "invented-guest" ->
              ready(
                  new Allocation(
                      UUID.fromString(item),
                      "EQUAL",
                      List.of(share(UUID.randomUUID().toString(), 1))));
          case "negative" ->
              ready(
                  new Allocation(
                      UUID.fromString(item), "WEIGHTS", List.of(share(a, -1), share(b, 2))));
          case "duplicate-guest" ->
              ready(
                  new Allocation(
                      UUID.fromString(item), "EQUAL", List.of(share(a, 1), share(a, 1))));
          case "duplicate-item" -> ready(valid, valid);
          case "unknown-mode" ->
              ready(new Allocation(UUID.fromString(item), "REFUND", valid.shares()));
          case "empty" -> ready();
          default -> new Interpretation("READY", "Do you mean this?", "Summary", List.of(valid));
        };
    when(client.interpret(anyString(), anyMap())).thenReturn(output);
    assertEquals("CLARIFY", preview("Share I1").path("status").asText());
    assertEquals(0, proposals());
    assertEquals(10001, due(a));
    assertEquals(
        0,
        db.number("SELECT count(*) FROM ai_split_draft WHERE session_id=?", UUID.fromString(sid)));
  }

  @Test
  void duplicateDishNamesAskForReferencesWithoutCallingAi() {
    item();
    item();
    assertEquals("CLARIFY", preview("Split the Pizza equally").path("status").asText());
    verifyNoInteractions(client);
  }

  @Test
  void duplicateGuestNamesAskForReferencesWithoutCallingAi() {
    item();
    post(null, "/join", map("token", join, "nickname", "Diego"));
    assertEquals("CLARIFY", preview("Diego pays for Pizza").path("status").asText());
    verifyNoInteractions(client);
  }

  @Test
  void stalePreviewCannotBeConfirmed() {
    String item = item();
    when(client.interpret(anyString(), anyMap())).thenReturn(ready(equal(item)));
    var p = preview("Share I1 equally");
    item();
    fails(
        409,
        at,
        "/sessions/" + sid + "/ai-splits/" + p.path("draftId").asText() + "/confirm",
        map("revision", p.path("revision").asLong()));
    // Sending a newer revision cannot turn the stale preview into consent.
    fails(
        409,
        at,
        "/sessions/" + sid + "/ai-splits/" + p.path("draftId").asText() + "/confirm",
        rev());
    assertEquals(0, proposals());
  }

  @Test
  void concurrentChangeWhileAiRunsRequiresNewReview() {
    String item = item();
    when(client.interpret(anyString(), anyMap()))
        .thenAnswer(
            c -> {
              item();
              return ready(equal(item));
            });
    assertEquals("CLARIFY", preview("Share I1 equally").path("status").asText());
    assertEquals(0, proposals());
  }

  @Test
  void anotherDinerCannotConfirmOrAlterAnUnownedDish() {
    String item = item();
    when(client.interpret(anyString(), anyMap())).thenReturn(ready(equal(item)));
    var p = preview("Share I1");
    fails(
        404,
        bt,
        "/sessions/" + sid + "/ai-splits/" + p.path("draftId").asText() + "/confirm",
        rev());
    assertEquals(
        "CLARIFY",
        action(bt, "/ai-splits/preview", "instruction", "Share I1").path("status").asText());
    assertEquals(0, proposals());
  }

  @Test
  void retriesReuseSavedAiResultAndConfirmationReceipt() {
    String item = item();
    when(client.interpret(anyString(), anyMap())).thenReturn(ready(equal(item)));
    String key = UUID.randomUUID().toString();
    var body = rev("instruction", "Share I1");
    String path = "/api/sessions/" + sid + "/ai-splits/preview";
    var first = send(at, "POST", path, body, key);
    assertEquals(200, first.status());
    assertEquals(first.body(), send(at, "POST", path, body, key).body());
    verify(client, times(1)).interpret(anyString(), anyMap());
    body.put("instruction", "different");
    assertEquals(409, send(at, "POST", path, body, key).status());
    var confirm = rev();
    String cp =
        "/api/sessions/" + sid + "/ai-splits/" + first.body().path("draftId").asText() + "/confirm";
    String ck = UUID.randomUUID().toString();
    var proposed = send(at, "POST", cp, confirm, ck);
    assertEquals(200, proposed.status());
    assertEquals(proposed.body(), send(at, "POST", cp, confirm, ck).body());
    assertEquals(1, proposals());
  }

  @Test
  void reservedItemAndProviderFailureLeaveLedgerUnchanged() {
    String item = item();
    when(client.interpret(anyString(), anyMap())).thenReturn(ready(equal(item)));
    action(at, "/checkout/reservations", "target", "SELF", "guestIds", List.of());
    assertEquals("CLARIFY", preview("Share I1").path("status").asText());
    assertEquals(0, proposals());
    when(client.interpret(anyString(), anyMap()))
        .thenThrow(new IllegalStateException("provider unavailable"));
    assertEquals("CLARIFY", preview("Share I1").path("status").asText());
    assertEquals(10001, due(a));
  }
}
