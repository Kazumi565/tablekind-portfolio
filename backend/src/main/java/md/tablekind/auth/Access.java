package md.tablekind.auth;

import java.util.Map;
import java.util.UUID;
import md.tablekind.common.Db;
import md.tablekind.common.Problem;
import org.springframework.stereotype.Service;

@Service
public class Access {
  private final Db db;

  public Access(Db db) {
    this.db = db;
  }

  public void valid(Actor a) {
    String sql = switch (a.kind()) {
      case "STAFF" -> "SELECT token_version FROM staff_account WHERE id=? AND active=true";
      case "GUEST" -> "SELECT token_version FROM guest WHERE id=? AND active=true";
      case "CUSTOMER" -> "SELECT token_version FROM customer_account WHERE id=? AND active=true";
      case "PLATFORM" -> "SELECT token_version FROM platform_account WHERE id=? AND active=true";
      default -> throw Problem.forbidden();
    };
    var row =
        db.optional(sql, a.id())
            .orElseThrow(
                () -> new Problem(401, "TOKEN_REVOKED", "This sign-in is no longer active."));
    if (Db.amount(row, "token_version") != a.tokenVersion())
      throw new Problem(401, "TOKEN_REVOKED", "This sign-in is no longer active.");
  }

  public String staff(Actor a, UUID restaurant) {
    valid(a);
    if (!a.staff()) throw Problem.forbidden();
    return db.optional(
            "SELECT role FROM membership WHERE restaurant_id=? AND staff_id=?", restaurant, a.id())
        .map(r -> Db.text(r, "role"))
        .orElseThrow(Problem::forbidden);
  }

  public void manager(Actor a, UUID restaurant) {
    if (!java.util.Set.of("OWNER", "MANAGER").contains(staff(a, restaurant))) throw Problem.forbidden();
  }

  public void owner(Actor a, UUID restaurant) {
    if (!staff(a, restaurant).equals("OWNER")) throw Problem.forbidden();
  }

  public void customer(Actor a) {
    if (!a.customer()) throw Problem.forbidden();
    valid(a);
  }

  public void platform(Actor a) {
    if (!a.platform()) throw Problem.forbidden();
    valid(a);
  }

  public Map<String, Object> session(Actor a, UUID session) {
    if (!a.staff() && !a.guest()) throw Problem.forbidden();
    valid(a);
    var row = db.one("SELECT * FROM table_session WHERE id=?", session);
    if (a.staff()) staff(a, Db.id(row, "restaurant_id"));
    else if (db.number(
            "SELECT count(*) FROM guest WHERE id=? AND session_id=? AND active=true",
            a.id(),
            session)
        != 1) throw Problem.forbidden();
    return row;
  }

  public void guest(Actor a, UUID session) {
    session(a, session);
    if (!a.guest()) throw Problem.forbidden();
  }
}
