package md.tablekind.billing;

import java.util.*;
import md.tablekind.common.*;
import org.springframework.stereotype.Service;

@Service
public class Ledger {
  private final Db db;

  public Ledger(Db db) {
    this.db = db;
  }

  public long total(UUID sid, UUID item) {
    return db.number(
        "SELECT coalesce(sum(amount_bani),0) FROM bill_entry WHERE session_id=? AND item_id=?",
        sid,
        item);
  }

  public Map<UUID, Long> shares(UUID sid, UUID item) {
    Map<UUID, Long> result = new TreeMap<>(Comparator.comparing(UUID::toString));
    for (var r :
        db.list(
            "SELECT guest_id,sum(amount_bani) AS amount FROM allocation_entry WHERE session_id=?"
                + " AND item_id=? GROUP BY guest_id HAVING sum(amount_bani)>0 ORDER BY guest_id",
            sid,
            item)) result.put(Db.id(r, "guest_id"), Db.amount(r, "amount"));
    return result;
  }

  public void editable(UUID sid, UUID item) {
    if (db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM settlement_entry WHERE session_id=? AND"
                + " item_id=?",
            sid,
            item)
        > 0)
      throw Problem.conflict("This item has settled money. A manager must use the refund flow.");
    if (db.number(
            "SELECT count(*) FROM reservation_part p JOIN checkout_reservation r ON"
                + " r.id=p.reservation_id WHERE p.session_id=? AND p.item_id=? AND"
                + " (r.status='PROCESSING' OR (r.status='HELD' AND r.expires_at>now()))",
            sid,
            item)
        > 0) throw Problem.conflict("This item is locked by a checkout reservation.");
    if (db.number(
            "SELECT count(*) FROM refund_part x JOIN payment_refund r ON r.id=x.refund_id WHERE"
                + " x.session_id=? AND x.item_id=? AND r.status='PENDING'",
            sid,
            item)
        > 0) throw Problem.conflict("Resolve the pending refund before editing this item.");
    if (db.number(
            "SELECT count(*) FROM proposal_item i JOIN allocation_proposal p ON p.id=i.proposal_id"
                + " WHERE i.session_id=? AND i.item_id=? AND p.status='PENDING'",
            sid,
            item)
        > 0) throw Problem.conflict("Resolve the pending allocation proposal first.");
  }

  public void charge(
      UUID rid, UUID sid, UUID item, long delta, String kind, String reason, UUID batch) {
    db.update(
        "INSERT INTO"
            + " bill_entry(id,restaurant_id,session_id,item_id,amount_bani,kind,reason,batch_id)"
            + " VALUES(?,?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        rid,
        sid,
        item,
        delta,
        kind,
        reason,
        batch);
  }

  public void allocate(
      UUID rid, UUID sid, UUID item, UUID guest, long delta, String reason, UUID batch) {
    if (delta == 0) return;
    db.update(
        "INSERT INTO"
            + " allocation_entry(id,restaurant_id,session_id,item_id,guest_id,amount_bani,reason,batch_id)"
            + " VALUES(?,?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        rid,
        sid,
        item,
        guest,
        delta,
        reason,
        batch);
  }

  public void replace(
      UUID rid, UUID sid, UUID item, Map<UUID, Long> next, String reason, UUID batch) {
    if (next.values().stream().anyMatch(x -> x < 0)
        || next.values().stream().mapToLong(Long::longValue).sum() != total(sid, item))
      throw Problem.bad("The shares must equal the item's current total exactly.");
    var before = shares(sid, item);
    Set<UUID> guests = new HashSet<>(before.keySet());
    guests.addAll(next.keySet());
    for (UUID guest : guests)
      allocate(
          rid,
          sid,
          item,
          guest,
          next.getOrDefault(guest, 0L) - before.getOrDefault(guest, 0L),
          reason,
          batch);
  }

  public Map<String, Object> bill(UUID sid) {
    long total =
        db.number("SELECT coalesce(sum(amount_bani),0) FROM bill_entry WHERE session_id=?", sid);
    long paid =
        db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM settlement_entry WHERE session_id=?", sid);
    long held =
        db.number(
            "SELECT coalesce(sum(amount_bani),0) FROM checkout_reservation WHERE session_id=? AND"
                + " (status='PROCESSING' OR (status='HELD' AND expires_at>now()))",
            sid);
    var guests =
        db.list(
            "SELECT g.id,g.nickname,coalesce((SELECT sum(a.amount_bani) FROM allocation_entry a"
                + " WHERE a.session_id=g.session_id AND a.guest_id=g.id),0) AS"
                + " allocated_bani,coalesce((SELECT sum(s.amount_bani) FROM settlement_entry s"
                + " WHERE s.session_id=g.session_id AND s.guest_id=g.id),0) AS"
                + " paid_bani,coalesce((SELECT sum(p.amount_bani) FROM reservation_part p JOIN"
                + " checkout_reservation r ON r.id=p.reservation_id WHERE p.guest_id=g.id AND"
                + " (r.status='PROCESSING' OR (r.status='HELD' AND r.expires_at>now()))),0) AS"
                + " reserved_bani FROM guest g WHERE session_id=? ORDER BY g.joined_at,g.id",
            sid);
    for (var g : guests) {
      long due = Db.amount(g, "allocated_bani") - Db.amount(g, "paid_bani");
      g.put("remaining_bani", due);
      g.put("available_bani", due - Db.amount(g, "reserved_bani"));
    }
    return Map.of(
        "totalBani",
        total,
        "paidBani",
        paid,
        "reservedBani",
        held,
        "remainingBani",
        total - paid,
        "availableBani",
        total - paid - held,
        "guests",
        guests);
  }

  public record Part(UUID itemId, UUID guestId, long amountBani) {}

  public List<Part> available(UUID sid) {
    var rows =
        db.list(
            "SELECT a.item_id,a.guest_id,sum(a.amount_bani)-coalesce((SELECT sum(s.amount_bani)"
                + " FROM settlement_entry s WHERE s.item_id=a.item_id AND"
                + " s.guest_id=a.guest_id),0)-coalesce((SELECT sum(p.amount_bani) FROM"
                + " reservation_part p JOIN checkout_reservation r ON r.id=p.reservation_id WHERE"
                + " p.item_id=a.item_id AND p.guest_id=a.guest_id AND (r.status='PROCESSING' OR"
                + " (r.status='HELD' AND r.expires_at>now()))),0) AS available FROM"
                + " allocation_entry a WHERE a.session_id=? AND NOT EXISTS(SELECT 1 FROM"
                + " proposal_item i JOIN allocation_proposal p ON p.id=i.proposal_id WHERE"
                + " i.item_id=a.item_id AND p.status='PENDING') GROUP BY a.item_id,a.guest_id ORDER"
                + " BY a.item_id,a.guest_id",
            sid);
    return rows.stream()
        .filter(r -> Db.amount(r, "available") > 0)
        .map(r -> new Part(Db.id(r, "item_id"), Db.id(r, "guest_id"), Db.amount(r, "available")))
        .toList();
  }

  public List<Part> plan(UUID sid, Set<UUID> targets, Long requested) {
    var available =
        available(sid).stream()
            .filter(p -> targets.isEmpty() || targets.contains(p.guestId()))
            .toList();
    long amount =
        requested == null ? available.stream().mapToLong(Part::amountBani).sum() : requested;
    if (amount < 1 || amount > Money.MAX)
      throw Problem.bad("There is no payable amount for this selection.");
    long left = amount;
    List<Part> result = new ArrayList<>();
    for (var p : available) {
      long take = Math.min(left, p.amountBani());
      if (take > 0) result.add(new Part(p.itemId(), p.guestId(), take));
      left -= take;
    }
    if (left != 0)
      throw Problem.conflict("The requested amount exceeds the currently available shares.");
    return result;
  }
}
