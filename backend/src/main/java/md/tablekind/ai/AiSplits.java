package md.tablekind.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.billing.*;
import md.tablekind.common.*;
import md.tablekind.session.Sessions;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AiSplits {
  private final Db db;
  private final Access access;
  private final Sessions sessions;
  private final Ledger ledger;
  private final Allocations allocations;
  private final SplitAiClient client;
  private final AiSettings settings;
  private final ObjectMapper json;
  private final TransactionTemplate tx;

  public AiSplits(
      Db db,
      Access access,
      Sessions sessions,
      Ledger ledger,
      Allocations allocations,
      SplitAiClient client,
      AiSettings settings,
      ObjectMapper json,
      PlatformTransactionManager tm) {
    this.db = db;
    this.access = access;
    this.sessions = sessions;
    this.ledger = ledger;
    this.allocations = allocations;
    this.client = client;
    this.settings = settings;
    this.json = json;
    this.tx = new TransactionTemplate(tm);
  }

  public void authorize(Actor a, UUID sid) {
    access.guest(a, sid);
  }

  private Map<String, Object> clarify(String question) {
    return Map.of("status", "CLARIFY", "question", question);
  }

  public Object preview(Actor a, UUID sid, UUID key, long revision, String instruction) {
    authorize(a, sid);
    String hash = Commands.hash(sid + ":" + revision + ":" + instruction);
    var saved =
        tx.execute(
            t -> {
              // A global budget lock makes the total call cap durable across restarts and replicas.
              db.number(
                  "SELECT 1 FROM (SELECT"
                      + " pg_advisory_xact_lock(hashtextextended('tablekind-ai-budget',0))) x");
              var prior = db.optional("SELECT * FROM ai_usage WHERE id=?", key);
              if (prior.isPresent()) {
                var p = prior.get();
                if (!a.id().equals(Db.id(p, "guest_id"))) throw Problem.forbidden();
                if (!hash.equals(p.get("request_hash")))
                  throw Problem.conflict(
                      "This AI request key was already used with different input.");
                if (p.get("result") != null) return Map.of("saved", p.get("result"));
                return Map.of(
                    "saved",
                    clarify(
                        "The previous interpretation has not completed. Wait a moment, then request"
                            + " a new preview if needed. No balances changed."));
              }
              if (!settings.configured())
                throw new Problem(
                    503,
                    "AI_DISABLED",
                    "AI access is not configured or paid calls have not been enabled by the demo"
                        + " operator.");
              var snapshot = snapshot(a, sid, revision);
              String ambiguity = ambiguity(instruction, snapshot);
              if (!ambiguity.isBlank()) return Map.of("saved", clarify(ambiguity));
              if (db.number("SELECT count(*) FROM ai_usage") >= settings.maxCalls())
                throw new Problem(
                    429, "AI_BUDGET", "The configured AI call allowance has been reached.");
              if (db.number(
                      "SELECT count(*) FROM ai_usage WHERE guest_id=? AND created_at>now()-interval"
                          + " '1 hour'",
                      a.id())
                  >= 20)
                throw new Problem(
                    429, "AI_LIMIT", "This diner has reached the hourly interpretation limit.");
              db.update(
                  "INSERT INTO ai_usage(id,guest_id,model,request_hash) VALUES(?,?,?,?)",
                  key,
                  a.id(),
                  settings.model(),
                  hash);
              return Map.of("snapshot", snapshot);
            });
    if (saved.containsKey("saved")) return saved.get("saved");
    Object result;
    try {
      @SuppressWarnings("unchecked")
      var snapshot = (Map<String, Object>) saved.get("snapshot");
      var interpreted = client.interpret(instruction, snapshot);
      result =
          tx.execute(
              t -> {
                sessions.lock(a, sid, revision);
                if (interpreted == null
                    || !Set.of("READY", "CLARIFY")
                        .contains(Objects.toString(interpreted.status(), "")))
                  throw Problem.bad("Invalid AI response");
                if ("CLARIFY".equals(interpreted.status())) {
                  if (interpreted.question() == null
                      || interpreted.question().isBlank()
                      || interpreted.question().length() > 1000
                      || interpreted.allocations() == null
                      || !interpreted.allocations().isEmpty())
                    throw Problem.bad("Invalid clarification");
                  return clarify(interpreted.question());
                }
                var plan = plan(a, sid, interpreted);
                UUID draft = UUID.randomUUID();
                var response = new LinkedHashMap<String, Object>(plan.preview());
                response.put("draftId", draft);
                response.put("revision", revision);
                response.put("status", "READY");
                db.update(
                    "INSERT INTO"
                        + " ai_split_draft(id,restaurant_id,session_id,guest_id,revision,preview)"
                        + " VALUES(?,?,?,?,?,?::jsonb)",
                    draft,
                    Db.id(access.session(a, sid), "restaurant_id"),
                    sid,
                    a.id(),
                    revision,
                    db.json(Map.of("response", response, "interpretation", interpreted)));
                return response;
              });
    } catch (Problem e) {
      result =
          clarify(
              e.code().equals("STALE_REVISION")
                  ? "The table changed while interpreting. Review the current bill and request a"
                        + " fresh preview."
                  : "That interpretation could not be safely applied. Use the listed item and guest"
                        + " references, and change only dishes you ordered or share.");
    } catch (Exception e) {
      result =
          clarify(
              "The AI service could not complete a valid interpretation. No balances changed. You"
                  + " can retry or use the manual split controls.");
    }
    final Object completed = result;
    tx.executeWithoutResult(
        t -> db.update("UPDATE ai_usage SET result=?::jsonb WHERE id=?", db.json(completed), key));
    return result;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> snapshot(Actor a, UUID sid, long revision) {
    var session = sessions.lock(a, sid, revision);
    var guests =
        db.list(
            "SELECT id,nickname FROM guest WHERE session_id=? AND active=true ORDER BY"
                + " joined_at,id",
            sid);
    var items =
        db.list(
            "SELECT id,snapshot->'names'->>'en' AS name,quantity,ordered_by FROM order_item WHERE"
                + " session_id=? AND status IN ('ACCEPTED','PREPARING','READY','SERVED') ORDER BY"
                + " created_at,id",
            sid);
    if (items.isEmpty() || items.size() > 40)
      throw Problem.bad("AI splitting supports tables with one to forty accepted items.");
    for (int n = 0; n < guests.size(); n++) guests.get(n).put("ref", "G" + (n + 1));
    for (int n = 0; n < items.size(); n++) items.get(n).put("ref", "I" + (n + 1));
    return Map.of(
        "revision", revision, "requestingGuestId", a.id(), "guests", guests, "items", items);
  }

  @SuppressWarnings("unchecked")
  private String ambiguity(String instruction, Map<String, Object> snapshot) {
    String text = instruction.toLowerCase(Locale.ROOT);
    for (String group : List.of("guests", "items")) {
      var entries = (List<Map<String, Object>>) snapshot.get(group);
      String nameKey = group.equals("guests") ? "nickname" : "name";
      for (var e : entries) {
        String name = Db.text(e, nameKey).toLowerCase(Locale.ROOT);
        var matches =
            entries.stream().filter(x -> Db.text(x, nameKey).equalsIgnoreCase(name)).toList();
        if (!name.isBlank()
            && matches.size() > 1
            && text.contains(name)
            && matches.stream()
                .noneMatch(
                    x ->
                        java.util.regex.Pattern.compile("(?i)\\b" + x.get("ref") + "\\b")
                            .matcher(instruction)
                            .find()))
          return "More than one "
              + (group.equals("guests") ? "diner" : "dish")
              + " is named '"
              + Db.text(e, nameKey)
              + "'. Specify "
              + matches.stream().map(x -> Db.text(x, "ref")).toList()
              + " in your request.";
      }
    }
    return "";
  }

  record Plan(Map<UUID, Map<UUID, Long>> matrix, Map<String, Object> preview) {}

  private Plan plan(Actor a, UUID sid, SplitAiClient.Interpretation i) {
    if (i.summary() == null
        || i.summary().isBlank()
        || i.summary().length() > 400
        || i.question() == null
        || !i.question().isBlank()
        || i.allocations() == null
        || i.allocations().isEmpty()
        || i.allocations().size() > 40) throw Problem.bad("Invalid split output");
    var guests = db.list("SELECT id,nickname FROM guest WHERE session_id=? AND active=true", sid);
    Map<UUID, String> names = new HashMap<>();
    guests.forEach(g -> names.put(Db.id(g, "id"), Db.text(g, "nickname")));
    Map<UUID, Map<UUID, Long>> matrix = new LinkedHashMap<>();
    Set<UUID> seen = new HashSet<>(), required = new TreeSet<>();
    List<Object> items = new ArrayList<>();
    Map<UUID, Long> totals = new LinkedHashMap<>();
    for (var g : guests)
      totals.put(
          Db.id(g, "id"),
          db.number(
              "SELECT coalesce(sum(amount_bani),0) FROM allocation_entry WHERE session_id=? AND"
                  + " guest_id=?",
              sid,
              Db.id(g, "id")));
    for (var allocation : i.allocations()) {
      if (allocation == null
          || allocation.itemId() == null
          || !seen.add(allocation.itemId())
          || allocation.shares() == null
          || allocation.shares().isEmpty()
          || allocation.shares().size() > 20
          || !Set.of("ASSIGN", "EQUAL", "WEIGHTS")
              .contains(Objects.toString(allocation.mode(), "")))
        throw Problem.bad("Invalid item allocation");
      UUID item = allocation.itemId();
      var row =
          db.one(
              "SELECT ordered_by,snapshot->'names'->>'en' AS name FROM order_item WHERE id=? AND"
                  + " session_id=? AND status IN ('ACCEPTED','PREPARING','READY','SERVED')",
              item,
              sid);
      Map<UUID, Long> weights = new LinkedHashMap<>();
      for (var share : allocation.shares()) {
        if (share == null
            || !names.containsKey(share.guestId())
            || share.weight() < 1
            || share.weight() > 1_000_000
            || weights.put(share.guestId(), share.weight()) != null)
          throw Problem.bad("Invalid diner reference or weight");
        if (!allocation.mode().equals("WEIGHTS") && share.weight() != 1)
          throw Problem.bad("Equal shares require equal weights");
      }
      if (allocation.mode().equals("ASSIGN") && weights.size() != 1)
        throw Problem.bad("Assign to one diner");
      long total = ledger.total(sid, item);
      if (total <= 0) throw Problem.bad("Item has no charge");
      var target = Money.weighted(total, weights);
      var before = ledger.shares(sid, item);
      if (!target.equals(before)) {
        ledger.editable(sid, item);
        if (!before.containsKey(a.id()) && !a.id().equals(Db.id(row, "ordered_by")))
          throw Problem.forbidden();
        required.addAll(before.keySet());
        target.forEach(
            (g, v) -> {
              if (v > 0) required.add(g);
            });
        matrix.put(item, target);
        before.forEach((g, v) -> totals.computeIfPresent(g, (key, value) -> value - v));
        target.forEach((g, v) -> totals.merge(g, v, Long::sum));
      }
      items.add(
          Map.of(
              "itemId",
              item,
              "name",
              row.get("name"),
              "totalMinor",
              total,
              "shares",
              target.entrySet().stream()
                  .map(
                      e ->
                          Map.of(
                              "guestId",
                              e.getKey(),
                              "name",
                              names.get(e.getKey()),
                              "amountMinor",
                              e.getValue()))
                  .toList()));
    }
    if (matrix.isEmpty()) throw Problem.bad("The requested split already matches the bill.");
    UUID rid = Db.id(access.session(a, sid), "restaurant_id");
    return new Plan(
        matrix,
        Map.of(
            "summary",
            i.summary(),
            "currency",
            Db.text(db.one("SELECT currency FROM restaurant WHERE id=?", rid), "currency"),
            "items",
            items,
            "totals",
            totals.entrySet().stream()
                .map(
                    e ->
                        Map.of(
                            "guestId",
                            e.getKey(),
                            "name",
                            names.get(e.getKey()),
                            "amountMinor",
                            e.getValue()))
                .toList(),
            "requiredGuestIds",
            required));
  }

  public Object confirm(Actor a, UUID sid, UUID draft, long revision) {
    authorize(a, sid);
    sessions.lock(a, sid, revision);
    var d =
        db.one(
            "SELECT * FROM ai_split_draft WHERE id=? AND session_id=? AND guest_id=? FOR UPDATE",
            draft,
            sid,
            a.id());
    if (d.get("proposal_id") != null) return Map.of("proposalId", d.get("proposal_id"));
    if (Db.amount(d, "revision") != revision || Db.time(d, "expires_at").isBefore(Instant.now()))
      throw new Problem(
          409,
          "STALE_PREVIEW",
          "This preview expired or the table changed. Request and review a fresh preview.");
    var stored = json.valueToTree(d.get("preview"));
    var i = json.convertValue(stored.path("interpretation"), SplitAiClient.Interpretation.class);
    var plan = plan(a, sid, i);
    @SuppressWarnings("unchecked")
    var result =
        (Map<String, Object>) allocations.batch(a, sid, revision, plan.matrix(), i.summary());
    db.update(
        "UPDATE ai_split_draft SET proposal_id=? WHERE id=?", result.get("proposalId"), draft);
    return result;
  }
}
