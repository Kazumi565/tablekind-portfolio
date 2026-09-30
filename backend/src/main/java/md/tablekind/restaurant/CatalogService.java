package md.tablekind.restaurant;

import java.time.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.pos.PosCatalog;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class CatalogService {
  private final Db db;
  private final Access access;
  private final RestaurantRepository restaurants;
  private final PasswordEncoder passwords;
  private final PosCatalog pos;

  public CatalogService(
      Db db,
      Access access,
      RestaurantRepository restaurants,
      PasswordEncoder passwords,
      PosCatalog pos) {
    this.db = db;
    this.access = access;
    this.restaurants = restaurants;
    this.passwords = passwords;
    this.pos = pos;
  }

  public Object create(Actor a, String name) {
    authorizeCreate(a);
    UUID id = UUID.randomUUID();
    restaurants.saveAndFlush(new Restaurant(id, name.trim()));
    db.update(
        "INSERT INTO membership(restaurant_id,staff_id,role) VALUES(?,?,'OWNER')", id, a.id());
    audit(a, id, "RESTAURANT_CREATED", Map.of("name", name));
    return Map.of("id", id, "name", name);
  }

  public void authorizeCreate(Actor a) {
    access.valid(a);
    if (!a.staff()) throw Problem.forbidden();
    boolean firstSeed = db.number("SELECT count(*) FROM restaurant") == 0 && db.number("SELECT count(*) FROM staff_account") == 1;
    if (!firstSeed && db.number("SELECT count(*) FROM membership WHERE staff_id=? AND role IN ('OWNER','MANAGER')", a.id()) == 0)
      throw Problem.forbidden();
  }

  public Object branch(Actor a, UUID rid, CatalogController.BranchRequest r) {
    access.manager(a, rid);
    validateHours(r.timezone(), r.hours());
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " branch(id,restaurant_id,name,timezone,approval_required,accepting_orders,hours)"
            + " VALUES(?,?,?,?,?,?,?::jsonb)",
        id,
        rid,
        r.name(),
        r.timezone(),
        r.approvalRequired(),
        r.acceptingOrders(),
        db.json(r.hours()));
    audit(a, rid, "BRANCH_CREATED", Map.of("branchId", id));
    return Map.of("id", id);
  }

  public Object configureBranch(Actor a, UUID rid, UUID bid, CatalogController.BranchRequest r) {
    access.manager(a, rid);
    validateHours(r.timezone(), r.hours());
    if (db.update(
            "UPDATE branch SET"
                + " name=?,timezone=?,approval_required=?,accepting_orders=?,hours=?::jsonb WHERE"
                + " restaurant_id=? AND id=?",
            r.name(),
            r.timezone(),
            r.approvalRequired(),
            r.acceptingOrders(),
            db.json(r.hours()),
            rid,
            bid)
        != 1) throw Problem.missing();
    audit(a, rid, "BRANCH_UPDATED", Map.of("branchId", bid));
    return Map.of("id", bid);
  }

  public Object table(Actor a, UUID rid, UUID bid, CatalogController.TableRequest r) {
    access.manager(a, rid);
    db.one("SELECT id FROM restaurant WHERE id=? FOR SHARE", rid);
    db.one("SELECT id FROM branch WHERE restaurant_id=? AND id=?", rid, bid);
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO dining_table(id,restaurant_id,branch_id,label,pilot_enabled,max_guests)"
            + " VALUES(?,?,?,?,?,?)",
        id,
        rid,
        bid,
        r.label(),
        r.pilotEnabled(),
        r.maxGuests());
    pos.mapTable(rid, id);
    audit(a, rid, "TABLE_CREATED", Map.of("tableId", id));
    return Map.of("id", id);
  }

  public Object configureTable(Actor a, UUID rid, UUID tid, CatalogController.TableRequest r) {
    access.manager(a, rid);
    db.one("SELECT id FROM dining_table WHERE restaurant_id=? AND id=? FOR UPDATE", rid, tid);
    if (db.number(
            "SELECT count(*) FROM guest g JOIN table_session s ON s.id=g.session_id WHERE"
                + " s.table_id=? AND s.status='OPEN' AND g.active=true",
            tid)
        > r.maxGuests())
      throw Problem.conflict("This table already has more guests than the proposed limit.");
    db.update(
        "UPDATE dining_table SET label=?,pilot_enabled=?,max_guests=? WHERE restaurant_id=? AND"
            + " id=?",
        r.label(),
        r.pilotEnabled(),
        r.maxGuests(),
        rid,
        tid);
    audit(a, rid, "TABLE_UPDATED", Map.of("tableId", tid));
    return Map.of("id", tid);
  }

  public Object addStaff(Actor a, UUID rid, CatalogController.StaffRequest r) {
    db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE", rid);
    authorizeStaffCreation(a, rid, r.role());
    AccountPasswords.validate(r.password());
    String email = r.email().toLowerCase(Locale.ROOT).trim();
    var existing = db.optional("SELECT id FROM staff_account WHERE email=?", email);
    if (existing.isPresent())
      throw Problem.conflict(
          "That email already has an account. Existing-account invitations are outside this"
              + " checkpoint.");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO staff_account(id,email,display_name,password_hash) VALUES(?,?,?,?)",
        id,
        email,
        r.displayName(),
        passwords.encode(r.password()));
    db.update(
        "INSERT INTO membership(restaurant_id,staff_id,role) VALUES(?,?,?)", rid, id, r.role());
    audit(a, rid, "STAFF_CREATED", Map.of("staffId", id, "role", r.role()));
    return Map.of("id", id);
  }

  public Object removeStaff(Actor a, UUID rid, UUID sid) {
    db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE", rid);
    authorizeStaffRemoval(a, rid, sid);
    if (a.id().equals(sid)) throw Problem.bad("You cannot remove your own membership here.");
    var target = db.optional("SELECT role FROM membership WHERE restaurant_id=? AND staff_id=?", rid, sid);
    if (target.isPresent()) {
      db.update("DELETE FROM membership WHERE restaurant_id=? AND staff_id=?", rid, sid);
      audit(a, rid, "MEMBERSHIP_REMOVED", Map.of("staffId", sid, "role", Db.text(target.get(), "role")));
    }
    return Map.of("removed", true);
  }

  public void authorizeStaffCreation(Actor a, UUID rid, String role) {
    access.manager(a, rid);
    if (!role.equals("WAITER")) access.owner(a, rid);
  }

  public void authorizeStaffRemoval(Actor a, UUID rid, UUID sid) {
    access.manager(a, rid);
    var target = db.optional("SELECT role FROM membership WHERE restaurant_id=? AND staff_id=?", rid, sid);
    // A removed target has no authority to inspect. Owner check is retained for replay
    // through the immutable record of the original member's assigned role.
    String role = target.map(r -> Db.text(r, "role")).orElseGet(() ->
        db.optional("SELECT detail->>'role' AS role FROM audit_event WHERE restaurant_id=? AND action IN ('STAFF_CREATED','MEMBERSHIP_REMOVED')"
            + " AND detail->>'staffId'=? ORDER BY id DESC LIMIT 1", rid, sid.toString())
            .map(r -> Db.text(r, "role")).orElse("MANAGER"));
    if (role.equals("OWNER")) throw Problem.conflict("Transfer ownership before removing an owner.");
    if (!role.equals("WAITER")) access.owner(a, rid);
  }

  public void authorizeOwner(Actor a, UUID rid) { access.owner(a, rid); }

  public Object changeRole(Actor a, UUID rid, UUID sid, String role) {
    db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE", rid);
    access.owner(a, rid);
    var target = db.one("SELECT role FROM membership WHERE restaurant_id=? AND staff_id=?", rid, sid);
    if (Db.text(target, "role").equals("OWNER")) throw Problem.conflict("Use ownership transfer to change the owner.");
    db.update("UPDATE membership SET role=? WHERE restaurant_id=? AND staff_id=?", role, rid, sid);
    audit(a, rid, "STAFF_ROLE_CHANGED", Map.of("staffId", sid, "role", role));
    return Map.of("id", sid, "role", role);
  }

  public Object category(Actor a, UUID rid, CatalogController.CategoryRequest r) {
    access.manager(a, rid);
    pos.requireLocal(rid);
    names(r.names());
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO category(id,restaurant_id,names,sort_order) VALUES(?,?,?::jsonb,?)",
        id,
        rid,
        db.json(r.names()),
        r.sortOrder());
    audit(a, rid, "CATEGORY_CREATED", Map.of("categoryId", id));
    return Map.of("id", id);
  }

  public Object product(Actor a, UUID rid, UUID pid, CatalogController.ProductRequest r) {
    access.manager(a, rid);
    pos.requireLocal(rid);
    names(r.names());
    namesOptional(r.descriptions());
    db.one("SELECT id FROM category WHERE restaurant_id=? AND id=?", rid, r.categoryId());
    UUID id = pid == null ? UUID.randomUUID() : pid;
    if (pid == null)
      db.update(
          "INSERT INTO"
              + " product(id,restaurant_id,category_id,names,descriptions,allergens,dietary_labels,price_bani,available)"
              + " VALUES(?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?)",
          id,
          rid,
          r.categoryId(),
          db.json(r.names()),
          db.json(r.descriptions()),
          db.json(r.allergens()),
          db.json(r.dietaryLabels()),
          r.priceBani(),
          r.available());
    else if (db.update(
            "UPDATE product SET"
                + " category_id=?,names=?::jsonb,descriptions=?::jsonb,allergens=?::jsonb,dietary_labels=?::jsonb,price_bani=?,available=?,version=version+1"
                + " WHERE restaurant_id=? AND id=?",
            r.categoryId(),
            db.json(r.names()),
            db.json(r.descriptions()),
            db.json(r.allergens()),
            db.json(r.dietaryLabels()),
            r.priceBani(),
            r.available(),
            rid,
            id)
        != 1) throw Problem.missing();
    audit(a, rid, "PRODUCT_SAVED", Map.of("productId", id));
    return db.one("SELECT * FROM product WHERE id=?", id);
  }

  public Object availability(Actor a, UUID rid, UUID pid, boolean available) {
    access.staff(a, rid);
    pos.requireLocal(rid);
    if (db.update(
            "UPDATE product SET available=?,version=version+1 WHERE restaurant_id=? AND id=?",
            available,
            rid,
            pid)
        != 1) throw Problem.missing();
    audit(a, rid, "AVAILABILITY_CHANGED", Map.of("productId", pid, "available", available));
    return Map.of("id", pid, "available", available);
  }

  public Object modifiers(Actor a, UUID rid, UUID pid, CatalogController.ModifiersRequest r) {
    access.manager(a, rid);
    pos.requireLocal(rid);
    db.one("SELECT id FROM product WHERE restaurant_id=? AND id=? FOR UPDATE", rid, pid);
    // Historical order options are snapshots, so replacing live menu choices is safe.
    db.update(
        "DELETE FROM modifier_option WHERE group_id IN(SELECT id FROM modifier_group WHERE"
            + " restaurant_id=? AND product_id=?)",
        rid,
        pid);
    db.update("DELETE FROM modifier_group WHERE restaurant_id=? AND product_id=?", rid, pid);
    for (var g : r.groups()) {
      names(g.names());
      if (g.maxSelect() < g.minSelect() || g.maxSelect() > g.options().size())
        throw Problem.bad("Modifier limits do not match the options.");
      UUID gid = UUID.randomUUID();
      db.update(
          "INSERT INTO modifier_group(id,restaurant_id,product_id,names,min_select,max_select)"
              + " VALUES(?,?,?,?::jsonb,?,?)",
          gid,
          rid,
          pid,
          db.json(g.names()),
          g.minSelect(),
          g.maxSelect());
      for (var option : g.options()) {
        names(option.names());
        db.update(
            "INSERT INTO modifier_option(id,restaurant_id,group_id,names,price_bani,available)"
                + " VALUES(?,?,?,?::jsonb,?,?)",
            UUID.randomUUID(),
            rid,
            gid,
            db.json(option.names()),
            option.priceBani(),
            option.available());
      }
    }
    db.update("UPDATE product SET version=version+1 WHERE id=?", pid);
    audit(a, rid, "MODIFIERS_UPDATED", Map.of("productId", pid));
    return Map.of("id", pid);
  }

  public Map<String, Object> menu(UUID rid) {
    var products = db.list("SELECT * FROM product WHERE restaurant_id=? ORDER BY id", rid);
    for (var p : products) {
      var groups =
          db.list(
              "SELECT * FROM modifier_group WHERE restaurant_id=? AND product_id=? ORDER BY id",
              rid,
              Db.id(p, "id"));
      for (var g : groups)
        g.put(
            "options",
            db.list(
                "SELECT * FROM modifier_option WHERE restaurant_id=? AND group_id=? ORDER BY id",
                rid,
                Db.id(g, "id")));
      p.put("modifierGroups", groups);
    }
    return Map.of(
        "categories",
        db.list("SELECT * FROM category WHERE restaurant_id=? ORDER BY sort_order,id", rid),
        "products",
        products);
  }

  public Object dashboard(Actor a, UUID rid) {
    String role = access.staff(a, rid);
    return Map.of(
        "restaurant",
        db.one("SELECT * FROM restaurant WHERE id=?", rid),
        "role",
        role,
        "posManaged",
        db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=?", rid) > 0,
        "branches",
        db.list("SELECT * FROM branch WHERE restaurant_id=? ORDER BY name", rid),
        "tables",
        db.list(
            "SELECT t.*,s.id AS session_id,s.revision,s.qr_expires_at,(SELECT count(*) FROM guest g"
                + " WHERE g.session_id=s.id AND g.active) AS guest_count, coalesce((SELECT"
                + " sum(amount_bani) FROM bill_entry WHERE session_id=s.id),0) -coalesce((SELECT"
                + " sum(amount_bani) FROM settlement_entry WHERE session_id=s.id),0) AS"
                + " remaining_bani, (SELECT count(*) FROM payment_attempt WHERE session_id=s.id AND"
                + " status='PENDING' AND method IN ('CASH','TERMINAL')) AS collection_requests,"
                + " (SELECT count(*) FROM order_item WHERE session_id=s.id AND status='SUBMITTED')"
                + " AS pending_orders, (SELECT count(*) FROM assistance_request WHERE"
                + " session_id=s.id AND status='OPEN') AS help_requests FROM dining_table t LEFT"
                + " JOIN table_session s ON s.table_id=t.id AND s.status='OPEN' WHERE"
                + " t.restaurant_id=? ORDER BY t.label",
            rid),
        "recentSessions",
        db.list(
            "SELECT s.id,s.closed_at,t.label FROM table_session s JOIN dining_table t ON"
                + " t.id=s.table_id WHERE s.restaurant_id=? AND s.status='CLOSED' ORDER BY"
                + " s.closed_at DESC,s.id LIMIT 50",
            rid),
        "menu",
        menu(rid),
        "staff",
        java.util.Set.of("OWNER", "MANAGER").contains(role)
            ? db.list(
                "SELECT a.id,a.email,a.display_name,m.role FROM membership m JOIN staff_account a"
                    + " ON a.id=m.staff_id WHERE m.restaurant_id=? ORDER BY a.display_name",
                rid)
            : List.of());
  }

  public void audit(Actor a, UUID rid, String action, Object detail) {
    db.update(
        "INSERT INTO audit_event(restaurant_id,actor_id,action,detail) VALUES(?,?,?,?::jsonb)",
        rid,
        a.id(),
        action,
        db.json(detail));
  }

  public static void names(Map<String, String> value) {
    namesOptional(value);
    if (value.getOrDefault("en", "").isBlank()) throw Problem.bad("An English name is required.");
  }

  public static void namesOptional(Map<String, String> value) {
    if (value == null
        || value.size() > 3
        || !Set.of("en", "ro", "ru").containsAll(value.keySet())
        || value.values().stream().anyMatch(v -> v == null || v.length() > 1000))
      throw Problem.bad("Use en, ro and ru translation fields of at most 1,000 characters.");
  }

  public static void validateHours(String timezone, List<CatalogController.Hours> hours) {
    ZoneId.of(timezone);
    for (var h : hours) {
      LocalTime.parse(h.opens());
      LocalTime.parse(h.closes());
    }
  }

  @SuppressWarnings("unchecked")
  public void requireOpen(UUID table) {
    var b =
        db.one(
            "SELECT b.* FROM branch b JOIN dining_table t ON t.branch_id=b.id WHERE t.id=?", table);
    if (!Db.bool(b, "accepting_orders")) throw Problem.conflict("This branch has paused orders.");
    var hours = (List<Map<String, Object>>) b.get("hours");
    if (hours.isEmpty()) return;
    ZonedDateTime now = ZonedDateTime.now(ZoneId.of(Db.text(b, "timezone")));
    boolean open =
        hours.stream()
            .anyMatch(
                h -> {
                  int day = ((Number) h.get("day")).intValue();
                  LocalTime start = LocalTime.parse(h.get("opens").toString()),
                      end = LocalTime.parse(h.get("closes").toString());
                  int today = now.getDayOfWeek().getValue();
                  LocalTime time = now.toLocalTime();
                  if (end.isAfter(start))
                    return today == day && !time.isBefore(start) && time.isBefore(end);
                  return (today == day && !time.isBefore(start))
                      || (today == (day % 7) + 1 && time.isBefore(end));
                });
    if (!open) throw Problem.conflict("The kitchen is outside its configured opening hours.");
  }
}
