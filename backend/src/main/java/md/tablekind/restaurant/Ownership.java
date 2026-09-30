package md.tablekind.restaurant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
public class Ownership {
  private final Db db; private final Access access; private final Commands commands; private final CatalogService catalog;
  public Ownership(Db db, Access access, Commands commands, CatalogService catalog) {
    this.db=db; this.access=access; this.commands=commands; this.catalog=catalog;
  }
  public record Transfer(@NotNull UUID staffId, @NotBlank @Size(max=400) String reason) {}
  @PostMapping("/api/restaurants/{rid}/ownership")
  @Transactional
  public Object transfer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid,
      @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody Transfer r) {
    var a=Actor.from(jwt);
    db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE",rid);
    access.manager(a,rid);
    if (!access.staff(a,rid).equals("OWNER")) {
      // A successful transfer demotes its sender. Only that exact recorded transfer
      // may replay while the sender is still a manager and its recipient still owns it.
      if (db.number("SELECT count(*) FROM membership WHERE restaurant_id=? AND staff_id=? AND role='OWNER'",rid,r.staffId()) != 1
          || db.number("SELECT count(*) FROM audit_event WHERE restaurant_id=? AND actor_id=? AND action='OWNERSHIP_TRANSFERRED' AND detail->>'commandKey'=?",rid,a.id(),key.toString()) != 1)
        throw Problem.forbidden();
      return commands.replay(a.scope(),key,"ownership:"+rid,r).orElseThrow(Problem::forbidden);
    }
    return commands.run(a.scope(),key,"ownership:"+rid,r,()->{
      if (a.id().equals(r.staffId())) throw Problem.bad("Choose another manager for the transfer.");
      var target=db.one("SELECT m.role FROM membership m JOIN staff_account s ON s.id=m.staff_id"
          + " WHERE m.restaurant_id=? AND m.staff_id=? AND s.active",rid,r.staffId());
      if (!Db.text(target,"role").equals("MANAGER")) throw Problem.bad("The new owner must already be a manager of this restaurant.");
      db.update("UPDATE membership SET role='MANAGER' WHERE restaurant_id=? AND staff_id=?",rid,a.id());
      db.update("UPDATE membership SET role='OWNER' WHERE restaurant_id=? AND staff_id=?",rid,r.staffId());
      catalog.audit(a,rid,"OWNERSHIP_TRANSFERRED",Map.of("newOwner",r.staffId(),"reason",r.reason(),"commandKey",key));
      return Map.of("ownerId",r.staffId());
    });
  }
}
