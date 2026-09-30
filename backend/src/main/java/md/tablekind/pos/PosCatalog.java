package md.tablekind.pos;

import static md.tablekind.pos.PosConnector.*;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import md.tablekind.common.*;
import org.springframework.stereotype.Service;

/** Connector catalog import runs atomically; an unchanged source product retains its version. */
@Service
public class PosCatalog {
  private final Db db;
  private final ObjectMapper json;

  public PosCatalog(Db db, ObjectMapper json) {
    this.db = db;
    this.json = json;
  }

  private Map<String, String> names(Object v) {
    return json.convertValue(v, new TypeReference<Map<String, String>>() {});
  }

  private List<String> strings(Object v) {
    return json.convertValue(v, new TypeReference<List<String>>() {});
  }

  private String seedMapping(UUID rid, String kind, UUID local) {
    String external = "TEST-" + kind + "-" + local;
    db.update(
        "INSERT INTO pos_mapping(restaurant_id,kind,external_id,local_id) VALUES(?,?,?,?) ON"
            + " CONFLICT DO NOTHING",
        rid,
        kind,
        external,
        local);
    return external;
  }

  public void mapTable(UUID rid, UUID table) {
    if (db.number(
            "SELECT count(*) FROM pos_connection WHERE restaurant_id=? AND connector='MOCK'", rid)
        == 1) seedMapping(rid, "TABLE", table);
  }

  public void requireLocal(UUID rid) {
    db.one("SELECT id FROM restaurant WHERE id=? FOR SHARE", rid);
    if (db.number("SELECT count(*) FROM pos_connection WHERE restaurant_id=?", rid) > 0)
      throw Problem.conflict(
          "This menu is POS-managed. Change the source catalog, then import it in POS"
              + " integration.");
  }

  public Catalog seed(UUID rid) {
    List<Product> products = new ArrayList<>();
    for (var t : db.list("SELECT id FROM dining_table WHERE restaurant_id=?", rid))
      mapTable(rid, Db.id(t, "id"));
    for (var p :
        db.list(
            "SELECT p.*,c.names AS category_names FROM product p JOIN category c ON"
                + " c.id=p.category_id WHERE p.restaurant_id=? ORDER BY p.id",
            rid)) {
      UUID pid = Db.id(p, "id");
      List<Group> groups = new ArrayList<>();
      for (var g : db.list("SELECT * FROM modifier_group WHERE product_id=? ORDER BY id", pid)) {
        List<Option> options = new ArrayList<>();
        for (var o :
            db.list("SELECT * FROM modifier_option WHERE group_id=? ORDER BY id", Db.id(g, "id")))
          options.add(
              new Option(
                  seedMapping(rid, "OPTION", Db.id(o, "id")),
                  names(o.get("names")),
                  Db.amount(o, "price_bani"),
                  Db.bool(o, "available")));
        groups.add(
            new Group(
                seedMapping(rid, "GROUP", Db.id(g, "id")),
                names(g.get("names")),
                (int) Db.amount(g, "min_select"),
                (int) Db.amount(g, "max_select"),
                options));
      }
      var product =
          new Product(
              seedMapping(rid, "PRODUCT", pid),
              seedMapping(rid, "CATEGORY", Db.id(p, "category_id")),
              names(p.get("category_names")),
              names(p.get("names")),
              names(p.get("descriptions")),
              strings(p.get("allergens")),
              strings(p.get("dietary_labels")),
              Db.amount(p, "price_bani"),
              Db.bool(p, "available"),
              groups);
      products.add(product);
      db.update(
          "UPDATE pos_mapping SET source_hash=? WHERE restaurant_id=? AND kind='PRODUCT' AND"
              + " local_id=?",
          Commands.hash(db.json(product)),
          rid,
          pid);
    }
    var result = new Catalog(1, products);
    db.update(
        "INSERT INTO mock_pos_account(restaurant_id,catalog) VALUES(?,?::jsonb)",
        rid,
        db.json(result));
    db.update(
        "UPDATE pos_connection SET catalog_revision=1,catalog_hash=? WHERE restaurant_id=?",
        Commands.hash(db.json(result)),
        rid);
    return result;
  }

  private UUID local(UUID rid, String kind, String external) {
    var found =
        db.optional(
            "SELECT local_id FROM pos_mapping WHERE restaurant_id=? AND kind=? AND external_id=?",
            rid,
            kind,
            external);
    if (found.isPresent()) return Db.id(found.get(), "local_id");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO pos_mapping(restaurant_id,kind,external_id,local_id) VALUES(?,?,?,?)",
        rid,
        kind,
        external,
        id);
    return id;
  }

  public Object apply(UUID rid, Catalog source) {
    validate(source);
    var c = db.one("SELECT * FROM pos_connection WHERE restaurant_id=? FOR UPDATE", rid);
    String hash = Commands.hash(db.json(source));
    long previous = Db.amount(c, "catalog_revision");
    if (source.revision() < previous)
      throw Problem.conflict("The POS returned an older catalog. Nothing was changed.");
    if (source.revision() == previous) {
      if (!hash.equals(Db.text(c, "catalog_hash")))
        throw Problem.conflict("The POS reused a catalog version with different content.");
      return Map.of("changed", 0, "revision", previous);
    }
    int changed = 0;
    Set<UUID> retained = new HashSet<>();
    for (var p : source.products()) {
      UUID cid = local(rid, "CATEGORY", p.categoryRef()),
          pid = local(rid, "PRODUCT", p.externalId());
      retained.add(pid);
      db.update(
          "INSERT INTO category(id,restaurant_id,names) VALUES(?,?,?::jsonb) ON CONFLICT(id) DO"
              + " UPDATE SET names=excluded.names",
          cid,
          rid,
          db.json(p.categoryNames()));
      String productHash = Commands.hash(db.json(p));
      var m =
          db.one(
              "SELECT source_hash FROM pos_mapping WHERE restaurant_id=? AND kind='PRODUCT' AND"
                  + " local_id=?",
              rid,
              pid);
      if (productHash.equals(Db.text(m, "source_hash"))) continue;
      db.update(
          "INSERT INTO"
              + " product(id,restaurant_id,category_id,names,descriptions,allergens,dietary_labels,price_bani,available)"
              + " VALUES(?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?) ON CONFLICT(id) DO UPDATE"
              + " SET category_id=excluded.category_id,names=excluded.names,descriptions=excluded.descriptions,allergens=excluded.allergens,dietary_labels=excluded.dietary_labels,price_bani=excluded.price_bani,available=excluded.available,version=product.version+1",
          pid,
          rid,
          cid,
          db.json(p.names()),
          db.json(p.descriptions()),
          db.json(p.allergens()),
          db.json(p.dietaryLabels()),
          p.priceBani(),
          p.available());
      // IDs are restored from the external-ID map; historical orders retain their own snapshots.
      db.update(
          "DELETE FROM modifier_option WHERE group_id IN(SELECT id FROM modifier_group WHERE"
              + " product_id=?)",
          pid);
      db.update("DELETE FROM modifier_group WHERE product_id=?", pid);
      for (var g : p.groups()) {
        UUID gid = local(rid, "GROUP", g.externalId());
        db.update(
            "INSERT INTO modifier_group(id,restaurant_id,product_id,names,min_select,max_select)"
                + " VALUES(?,?,?,?::jsonb,?,?)",
            gid,
            rid,
            pid,
            db.json(g.names()),
            g.minSelect(),
            g.maxSelect());
        for (var o : g.options())
          db.update(
              "INSERT INTO modifier_option(id,restaurant_id,group_id,names,price_bani,available)"
                  + " VALUES(?,?,?,?::jsonb,?,?)",
              local(rid, "OPTION", o.externalId()),
              rid,
              gid,
              db.json(o.names()),
              o.priceBani(),
              o.available());
      }
      db.update(
          "UPDATE pos_mapping SET source_hash=? WHERE restaurant_id=? AND kind='PRODUCT' AND"
              + " local_id=?",
          productHash,
          rid,
          pid);
      changed++;
    }
    for (var p :
        db.list(
            "SELECT p.id FROM product p JOIN pos_mapping m ON m.local_id=p.id AND"
                + " m.restaurant_id=p.restaurant_id AND m.kind='PRODUCT' WHERE p.restaurant_id=?"
                + " AND p.available",
            rid)) {
      if (!retained.contains(Db.id(p, "id"))) {
        db.update(
            "UPDATE product SET available=false,version=version+1 WHERE id=?", Db.id(p, "id"));
        db.update(
            "UPDATE pos_mapping SET source_hash=NULL WHERE restaurant_id=? AND kind='PRODUCT' AND"
                + " local_id=?",
            rid,
            Db.id(p, "id"));
        changed++;
      }
    }
    db.update(
        "UPDATE pos_connection SET catalog_revision=?,catalog_hash=? WHERE restaurant_id=?",
        source.revision(),
        hash,
        rid);
    return Map.of("changed", changed, "revision", source.revision());
  }

  private void validate(Catalog c) {
    if (c == null || c.revision() < 1 || c.products() == null || c.products().size() > 2000)
      throw Problem.bad("Invalid POS catalog.");
    Set<String> products = new HashSet<>(), groups = new HashSet<>(), options = new HashSet<>();
    Map<String, Map<String, String>> categories = new HashMap<>();
    for (var p : c.products()) {
      if (p == null) throw Problem.bad("Invalid POS product.");
      unique(products, p.externalId());
      ref(p.categoryRef());
      checkNames(p.names(), true);
      checkNames(p.categoryNames(), true);
      checkNames(p.descriptions(), false);
      price(p.priceBani());
      if (categories.containsKey(p.categoryRef())
          && !categories.get(p.categoryRef()).equals(p.categoryNames()))
        throw Problem.bad("Conflicting POS category names.");
      categories.put(p.categoryRef(), p.categoryNames());
      labels(p.allergens(), 30);
      labels(p.dietaryLabels(), 20);
      if (p.groups() == null || p.groups().size() > 10)
        throw Problem.bad("Invalid POS modifier groups.");
      for (var g : p.groups()) {
        if (g == null) throw Problem.bad("Invalid POS modifier group.");
        unique(groups, g.externalId());
        checkNames(g.names(), true);
        if (g.options() == null
            || g.options().isEmpty()
            || g.options().size() > 20
            || g.minSelect() < 0
            || g.maxSelect() < 1
            || g.minSelect() > g.maxSelect()
            || g.maxSelect() > g.options().size())
          throw Problem.bad("Invalid POS modifier selection limits.");
        for (var o : g.options()) {
          if (o == null) throw Problem.bad("Invalid POS option.");
          unique(options, o.externalId());
          checkNames(o.names(), true);
          price(o.priceBani());
        }
      }
    }
  }

  private void unique(Set<String> set, String value) {
    ref(value);
    if (!set.add(value)) throw Problem.bad("Duplicate POS external ID.");
  }

  private void ref(String s) {
    if (s == null || s.isBlank() || s.length() > 160) throw Problem.bad("Invalid POS external ID.");
  }

  private void price(long n) {
    if (n < 0 || n > 10000000) throw Problem.bad("Unsupported POS price.");
  }

  private void labels(List<String> v, int max) {
    if (v == null || v.size() > max || v.stream().anyMatch(s -> s == null || s.length() > 60))
      throw Problem.bad("Invalid POS product labels.");
  }

  private void checkNames(Map<String, String> n, boolean required) {
    if (n == null
        || n.size() > 3
        || !Set.of("en", "ro", "ru").containsAll(n.keySet())
        || n.values().stream().anyMatch(v -> v == null || v.length() > 1000)
        || (required && (n.get("en") == null || n.get("en").isBlank())))
      throw Problem.bad("Invalid POS translations; English is required for names.");
  }
}
