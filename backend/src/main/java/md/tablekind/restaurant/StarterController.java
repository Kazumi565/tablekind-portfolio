package md.tablekind.restaurant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import md.tablekind.session.TableLinks;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** One atomic starter setup for an empty restaurant; custom edits remain available afterward. */
@RestController
@RequestMapping("/api/restaurants/{rid}/starter")
public class StarterController {
  private final Db db;
  private final Access access;
  private final Commands commands;
  private final CatalogService catalog;
  private final TableLinks links;

  public StarterController(Db db, Access access, Commands commands, CatalogService catalog, TableLinks links) {
    this.db=db; this.access=access; this.commands=commands; this.catalog=catalog; this.links=links;
  }

  public record Starter(@NotBlank @Size(max=120) String branchName,
      @NotBlank @Size(max=40) String tableLabel,
      @NotBlank @Size(max=120) String categoryName,
      @NotBlank @Size(max=120) String productName,
      @Min(1) @Max(10000000) long priceBani) {}

  @PostMapping
  public Object create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID rid,
      @RequestHeader("Idempotency-Key") UUID key, @Valid @RequestBody Starter input) {
    Actor actor=Actor.from(jwt);
    access.manager(actor,rid);
    return commands.run(actor.scope(),key,"restaurant-starter:"+rid,input,()->{
      db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE",rid);
      if (db.number("SELECT count(*) FROM branch WHERE restaurant_id=?",rid)!=0
          || db.number("SELECT count(*) FROM category WHERE restaurant_id=?",rid)!=0)
        throw Problem.conflict("This restaurant already has a branch or menu. Continue in the setup sections.");
      UUID branch=(UUID)((Map<?,?>)catalog.branch(actor,rid,
          new CatalogController.BranchRequest(input.branchName().trim(),"Europe/Chisinau",true,true,List.of()))).get("id");
      UUID table=(UUID)((Map<?,?>)catalog.table(actor,rid,branch,
          new CatalogController.TableRequest(input.tableLabel().trim(),true,20))).get("id");
      UUID category=(UUID)((Map<?,?>)catalog.category(actor,rid,
          new CatalogController.CategoryRequest(Map.of("en",input.categoryName().trim()),0))).get("id");
      catalog.product(actor,rid,null,new CatalogController.ProductRequest(category,
          Map.of("en",input.productName().trim()),Map.of(),List.of(),List.of(),input.priceBani(),true));
      // The printed code can be opened from the manager's QR screen; it uses that screen's origin.
      links.rotate(jwt,rid,table,UUID.randomUUID());
      return Map.of("branchId",branch,"tableId",table,"categoryId",category,"printedCodeReady",true);
    });
  }
}
