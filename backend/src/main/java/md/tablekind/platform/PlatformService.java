package md.tablekind.platform;

import java.time.Instant;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformService {
  private final Db db; private final Access access; private final AuthService auth;
  private final PasswordEncoder passwords; private final SecretBox box; private final Commands commands;
  private final String dummy;
  public PlatformService(Db db,Access access,AuthService auth,PasswordEncoder passwords,SecretBox box,Commands commands) {
    this.db=db;this.access=access;this.auth=auth;this.passwords=passwords;this.box=box;this.commands=commands;
    dummy=passwords.encode(UUID.randomUUID().toString());
  }

  private void verify(Map<String,Object> row,String password,String code) {
    if (!passwords.matches(password,Db.text(row,"password_hash")))
      throw new Problem(401,"LOGIN_FAILED","Administrator credentials are incorrect.");
    UUID id=Db.id(row,"id");
    long step=Totp.match(box.open(id,Db.text(row,"mfa_secret")),code,Instant.now().getEpochSecond(),Db.amount(row,"mfa_last_step"));
    if (step>=0) { db.update("UPDATE platform_account SET mfa_last_step=? WHERE id=?",step,id);return; }
    if (code!=null && code.matches("[a-f0-9]{64}") && db.update("UPDATE platform_account SET recovery_hash='' WHERE id=? AND recovery_hash=?",id,Commands.hash(code))==1) {
      audit(id,"RECOVERY_CODE_USED",null,"Administrator supplied a single-use recovery code.");return;
    }
    throw new Problem(401,"MFA_INVALID","Use a fresh authenticator code or your unused recovery code.");
  }

  @Transactional
  public Object login(PlatformController.Login r) {
    var row=db.optional("SELECT * FROM platform_account WHERE email=? AND active FOR UPDATE",r.email().trim().toLowerCase(Locale.ROOT));
    if (row.isEmpty()) { passwords.matches(r.password(),dummy);throw new Problem(401,"LOGIN_FAILED","Administrator credentials are incorrect."); }
    verify(row.get(),r.password(),r.code());
    UUID id=Db.id(row.get(),"id");audit(id,"LOGIN_SUCCEEDED",null,"Administrator signed in.");
    return auth.token(id,"PLATFORM",(int)Db.amount(row.get(),"token_version"));
  }

  private void proof(Actor a,PlatformController.Proof p) {
    access.platform(a);
    var row=db.one("SELECT * FROM platform_account WHERE id=? FOR UPDATE",a.id());
    access.platform(a);verify(row,p.password(),p.code());
  }

  private void passwordProof(Actor a,String password) {
    access.platform(a);
    var row=db.one("SELECT * FROM platform_account WHERE id=? FOR UPDATE",a.id());
    access.platform(a);
    if(!passwords.matches(password,Db.text(row,"password_hash")))
      throw new Problem(401,"PASSWORD_INCORRECT","The current administrator password is incorrect.");
  }

  public Object overview(Actor a) {
    access.platform(a);
    return Map.of("restaurants",db.list("SELECT r.id,r.name,r.created_at,"
        + "(SELECT count(*) FROM branch WHERE restaurant_id=r.id) AS branches,"
        + "(SELECT count(*) FROM table_session WHERE restaurant_id=r.id AND status='OPEN') AS open_tables,"
        + "(SELECT count(*) FROM membership WHERE restaurant_id=r.id) AS staff_count,"
        + "(SELECT a.email FROM membership m JOIN staff_account a ON a.id=m.staff_id WHERE m.restaurant_id=r.id AND m.role='OWNER') AS owner_email,"
        + "(SELECT count(*) FROM pos_outbox WHERE restaurant_id=r.id AND status='FAILED') AS failed_pos_messages"
        + " FROM restaurant r ORDER BY r.created_at DESC,r.id LIMIT 200"),
        "audit",db.list("SELECT action,restaurant_id,reason,created_at FROM platform_audit ORDER BY id DESC LIMIT 100"),
        "testOnly",true);
  }

  @Transactional
  public Object create(Actor a,UUID key,PlatformController.Create r) {
    proof(a,r.proof());AccountPasswords.validate(r.ownerPassword());
    // Keep receipt serialization stable across process restarts.
    var body=new LinkedHashMap<String,Object>();
    body.put("name",r.name());body.put("ownerEmail",r.ownerEmail().trim().toLowerCase(Locale.ROOT));
    body.put("ownerName",r.ownerName());body.put("ownerPassword",r.ownerPassword());body.put("reason",r.reason());
    return commands.run(a.scope(),key,"platform-restaurant",body,()->{
      UUID rid=UUID.randomUUID(),owner=UUID.randomUUID();
      if (db.number("SELECT count(*) FROM staff_account WHERE email=?",body.get("ownerEmail"))>0)
        throw Problem.conflict("That staff email already exists. Use restaurant ownership assignment for an existing restaurant.");
      db.update("INSERT INTO staff_account(id,email,display_name,password_hash) VALUES(?,?,?,?)",owner,body.get("ownerEmail"),r.ownerName(),passwords.encode(r.ownerPassword()));
      db.update("INSERT INTO restaurant(id,name) VALUES(?,?)",rid,r.name().trim());
      db.update("INSERT INTO membership(restaurant_id,staff_id,role) VALUES(?,?,'OWNER')",rid,owner);
      audit(a.id(),"RESTAURANT_PROVISIONED",rid,r.reason());
      return Map.of("restaurantId",rid,"ownerId",owner);
    });
  }

  @Transactional
  public Object assign(Actor a,UUID key,UUID rid,PlatformController.Assign r) {
    proof(a,r.proof());
    var body=new LinkedHashMap<String,Object>();
    body.put("email",r.ownerEmail().trim().toLowerCase(Locale.ROOT));body.put("reason",r.reason());
    return commands.run(a.scope(),key,"platform-owner:"+rid,body,()->{
      db.one("SELECT id FROM restaurant WHERE id=? FOR UPDATE",rid);
      if(db.number("SELECT count(*) FROM membership WHERE restaurant_id=? AND role='OWNER'",rid)>0)
        throw Problem.conflict("This restaurant already has an owner. Its owner can transfer access in management.");
      var owner=db.optional("SELECT a.id FROM staff_account a JOIN membership m ON m.staff_id=a.id"
          + " WHERE m.restaurant_id=? AND a.email=? AND a.active AND m.role='MANAGER'",rid,body.get("email")).orElseThrow(Problem::missing);
      db.update("UPDATE membership SET role='OWNER' WHERE restaurant_id=? AND staff_id=?",rid,Db.id(owner,"id"));
      audit(a.id(),"LEGACY_OWNER_ASSIGNED",rid,r.reason());
      return Map.of("ownerId",Db.id(owner,"id"));
    });
  }

  @Transactional
  public Object beginSecurity(Actor a,PlatformController.CurrentPassword r) {
    passwordProof(a,r.password());
    String secret=Totp.secret();
    db.update("UPDATE platform_account SET mfa_pending=?,mfa_pending_until=now()+interval '10 minutes' WHERE id=?",box.seal(a.id(),secret),a.id());
    return Map.of("secret",secret);
  }

  @Transactional
  public Object security(Actor a,PlatformController.Security r) {
    passwordProof(a,r.password());AccountPasswords.validate(r.newPassword());
    var row=db.one("SELECT mfa_pending,mfa_pending_until FROM platform_account WHERE id=?",a.id());
    if(row.get("mfa_pending")==null || !Db.time(row,"mfa_pending_until").isAfter(Instant.now()))
      throw Problem.conflict("Start a new authenticator replacement first.");
    long step=Totp.match(box.open(a.id(),Db.text(row,"mfa_pending")),r.newCode(),Instant.now().getEpochSecond(),-1);
    if(step<0) throw Problem.bad("Enter a code from the new authenticator before replacing security.");
    String recovery=AccountPasswords.recoveryCode();
    db.update("UPDATE platform_account SET password_hash=?,mfa_secret=mfa_pending,mfa_pending=NULL,mfa_pending_until=NULL,mfa_last_step=?,recovery_hash=?,token_version=token_version+1 WHERE id=?",
        passwords.encode(r.newPassword()),step,Commands.hash(recovery),a.id());
    audit(a.id(),"SECURITY_REPLACED",null,"Password, authenticator and recovery code replaced. All sessions revoked.");
    return Map.of("recoveryCode",recovery,"signedOut",true);
  }

  @Transactional
  public Object logout(Actor a) {
    access.platform(a);db.update("UPDATE platform_account SET token_version=token_version+1 WHERE id=?",a.id());
    return Map.of("signedOut",true);
  }

  public void audit(UUID id,String action,UUID rid,String reason) {
    db.update("INSERT INTO platform_audit(actor_id,action,restaurant_id,reason) VALUES(?,?,?,?)",id,action,rid,reason);
  }
}
