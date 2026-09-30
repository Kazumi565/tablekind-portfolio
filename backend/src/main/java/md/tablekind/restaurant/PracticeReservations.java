package md.tablekind.restaurant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Explicitly a local/demo rehearsal; there is no capacity hold or real confirmation. */
@RestController
@Profile({"local", "demo"})
@RequestMapping("/api")
public class PracticeReservations {
  private final Db db;
  private final Access access;
  private final Commands commands;
  private final CatalogService catalog;

  public PracticeReservations(Db db, Access access, Commands commands, CatalogService catalog) {
    this.db=db; this.access=access; this.commands=commands; this.catalog=catalog;
  }

  public record Request(@NotNull OffsetDateTime when, @Min(1) @Max(20) int partySize) {}
  public record Decision(@NotNull @Pattern(regexp="PRACTICE_APPROVED|DECLINED") String status) {}

  @GetMapping("/sessions/{sid}/practice-reservations")
  public Object mine(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid) {
    Actor actor=Actor.from(jwt); access.guest(actor,sid);
    return db.list("SELECT id,requested_for,party_size,status,created_at FROM practice_reservation"
        + " WHERE session_id=? AND guest_id=? ORDER BY created_at DESC LIMIT 50",sid,actor.id());
  }

  @PostMapping("/sessions/{sid}/practice-reservations")
  public Object request(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid,
      @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody Request input) {
    Actor actor=Actor.from(jwt); access.guest(actor,sid);
    return commands.run(actor.scope(),key,"practice-reservation:"+sid,input,()->{
      var guest=db.one("SELECT id FROM guest WHERE id=? AND session_id=? AND active FOR UPDATE",actor.id(),sid);
      var session=db.one("SELECT * FROM table_session WHERE id=?",sid);
      if (!"OPEN".equals(Db.text(session,"status"))) throw Problem.conflict("Only an open practice table can request a slot.");
      Instant when=input.when().toInstant();
      if (when.isBefore(Instant.now().plus(Duration.ofHours(1))) || when.isAfter(Instant.now().plus(Duration.ofDays(90))))
        throw Problem.bad("Choose a slot at least one hour and at most 90 days from now.");
      UUID branch=Db.id(db.one("SELECT branch_id FROM dining_table WHERE id=? AND restaurant_id=?",
          Db.id(session,"table_id"),Db.id(session,"restaurant_id")),"branch_id");
      if (db.number("SELECT count(*) FROM practice_reservation WHERE guest_id=? AND branch_id=?"
          + " AND requested_for=? AND status IN ('REQUESTED','PRACTICE_APPROVED')",actor.id(),branch,Timestamp.from(when))>0)
        throw Problem.conflict("You have already requested this practice slot.");
      UUID id=UUID.randomUUID(); UUID rid=Db.id(session,"restaurant_id");
      db.update("INSERT INTO practice_reservation(id,restaurant_id,branch_id,session_id,guest_id,requested_for,party_size)"
          + " VALUES(?,?,?,?,?,?,?)",id,rid,branch,sid,actor.id(),Timestamp.from(when),input.partySize());
      catalog.audit(actor,rid,"PRACTICE_RESERVATION_REQUESTED",Map.of("reservationId",id));
      return Map.of("id",id,"status","REQUESTED","practiceOnly",true);
    });
  }

  @PostMapping("/sessions/{sid}/practice-reservations/{id}/cancel")
  public Object cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID sid,@PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key) {
    Actor actor=Actor.from(jwt); access.guest(actor,sid);
    return commands.run(actor.scope(),key,"practice-cancel:"+id,Map.of(),()->{
      var row=db.one("SELECT restaurant_id,status FROM practice_reservation WHERE id=? AND session_id=? AND guest_id=? FOR UPDATE",
          id,sid,actor.id());
      if (!Set.of("REQUESTED","PRACTICE_APPROVED").contains(Db.text(row,"status")))
        throw Problem.conflict("This practice request has already ended.");
      db.update("UPDATE practice_reservation SET status='CANCELLED',reviewed_at=now() WHERE id=?",id);
      catalog.audit(actor,Db.id(row,"restaurant_id"),"PRACTICE_RESERVATION_CANCELLED",Map.of("reservationId",id));
      return Map.of("id",id,"status","CANCELLED");
    });
  }

  @GetMapping("/restaurants/{rid}/practice-reservations")
  public Object queue(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID rid) {
    access.manager(Actor.from(jwt),rid);
    return db.list("SELECT p.id,p.requested_for,p.party_size,p.status,p.created_at,b.name AS branch_name,"
        + " g.nickname FROM practice_reservation p JOIN branch b ON b.id=p.branch_id"
        + " JOIN guest g ON g.id=p.guest_id WHERE p.restaurant_id=? ORDER BY p.created_at DESC LIMIT 100",rid);
  }

  @PostMapping("/restaurants/{rid}/practice-reservations/{id}/decision")
  public Object decide(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID rid,@PathVariable UUID id,
      @RequestHeader("Idempotency-Key") UUID key,@Valid @RequestBody Decision input) {
    Actor actor=Actor.from(jwt); access.manager(actor,rid);
    return commands.run(actor.scope(),key,"practice-decision:"+rid+id,input,()->{
      var row=db.one("SELECT status FROM practice_reservation WHERE restaurant_id=? AND id=? FOR UPDATE",rid,id);
      if (!"REQUESTED".equals(Db.text(row,"status"))) throw Problem.conflict("This practice request is no longer awaiting review.");
      db.update("UPDATE practice_reservation SET status=?,reviewed_at=now() WHERE restaurant_id=? AND id=?",input.status(),rid,id);
      catalog.audit(actor,rid,"PRACTICE_RESERVATION_"+input.status(),Map.of("reservationId",id));
      return Map.of("id",id,"status",input.status(),"practiceOnly",true);
    });
  }
}
