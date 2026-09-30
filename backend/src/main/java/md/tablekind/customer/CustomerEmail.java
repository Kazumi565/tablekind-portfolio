package md.tablekind.customer;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class CustomerEmail {
  private final Db db;
  private final Access access;
  private final EmailSettings settings;
  private final PasswordEncoder passwords;
  private final SecretBox box;
  private final TransactionTemplate tx;
  private final byte[] key;
  private final SecureRandom random=new SecureRandom();

  public CustomerEmail(Db db, Access access, EmailSettings settings, PasswordEncoder passwords,
      SecretBox box, PlatformTransactionManager manager, @Value("${tablekind.jwt-secret}") String secret) {
    this.db=db; this.access=access; this.settings=settings; this.passwords=passwords; this.box=box;
    tx=new TransactionTemplate(manager);
    key=("tablekind:customer-email:v1:"+secret).getBytes(StandardCharsets.UTF_8);
  }

  public static String normalize(String email) {
    String value=email==null ? "" : email.trim().toLowerCase(Locale.ROOT);
    // Deliberately accept ordinary ASCII mailboxes only; no display names or SMTP header syntax.
    if (value.length()>254 || !value.matches("[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.[a-z]{2,63}"))
      throw Problem.bad("Enter an email address such as name@example.test.");
    return value;
  }

  private void enabled() {
    if (!settings.enabled()) throw new Problem(409,"EMAIL_DISABLED","Email is not enabled here. Use your saved recovery code.");
  }

  public void requireVerified(Map<String,Object> row) {
    if (settings.enabled() && (row.get("email_verified_at")==null
        || !settings.mode.equals(Db.text(row,"email_verification_mode"))))
      throw new Problem(403,"EMAIL_VERIFICATION_REQUIRED","Verify your email in My account before linking or resuming a visit.");
  }

  private Map<String,Object> account(Actor actor) {
    access.customer(actor);
    var row=db.one("SELECT * FROM customer_account WHERE id=? FOR UPDATE",actor.id());
    access.customer(actor);
    return row;
  }

  /** Joins the registration transaction; failure rolls back account creation and queued mail. */
  @Transactional
  public void registration(UUID id, String email) {
    if (!settings.enabled()) return;
    String recipient=normalize(email);
    db.update("UPDATE customer_account SET pending_email=? WHERE id=?",recipient,id);
    queue(id,"VERIFY",recipient);
  }

  private String digest(UUID id,String code) {
    try {
      var mac=Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key,"HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal((id+":"+code).getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
  }

  private void queue(UUID customer,String purpose,String recipient) {
    UUID id=UUID.randomUUID();
    String code=String.format(Locale.ROOT,"%08d",random.nextInt(100_000_000));
    db.update("DELETE FROM customer_email_challenge WHERE customer_id=? AND purpose=?",customer,purpose);
    db.update("INSERT INTO customer_email_challenge(id,customer_id,purpose,recipient,delivery_mode,code_hash,payload,expires_at)"
        + " VALUES(?,?,?,?,?,?,?,now()+interval '10 minutes')",id,customer,purpose,recipient,settings.mode,digest(id,code),box.seal(id,code));
    audit(customer,purpose.equals("VERIFY") ? "EMAIL_VERIFICATION_REQUESTED" : "EMAIL_RESET_REQUESTED");
  }

  private boolean cooling(UUID customer,String purpose) {
    return db.number("SELECT count(*) FROM customer_email_challenge WHERE customer_id=? AND purpose=?"
        + " AND created_at>now()-interval '60 seconds'",customer,purpose)>0;
  }

  @Transactional
  public Object request(Actor actor,String email,String password) {
    enabled(); var row=account(actor);
    if (!passwords.matches(password,Db.text(row,"password_hash")))
      throw new Problem(401,"PASSWORD_INCORRECT","The current password is incorrect.");
    String recipient=normalize(email);
    if (cooling(actor.id(),"VERIFY")) throw new Problem(429,"EMAIL_COOLDOWN","Wait 60 seconds before requesting another code.");
    db.update("UPDATE customer_account SET pending_email=? WHERE id=?",recipient,actor.id());
    queue(actor.id(),"VERIFY",recipient);
    return Map.of("queued",true,"testOnly",true);
  }

  @Transactional
  public Object resend(Actor actor) {
    enabled(); var row=account(actor);
    String recipient=Db.text(row,"pending_email");
    if (recipient.isBlank()) throw Problem.conflict("Add an email address first.");
    if (cooling(actor.id(),"VERIFY")) throw new Problem(429,"EMAIL_COOLDOWN","Wait 60 seconds before requesting another code.");
    queue(actor.id(),"VERIFY",recipient);
    return Map.of("queued",true,"testOnly",true);
  }

  private String check(Map<String,Object> row,String code) {
    if (row.get("consumed_at")!=null || !Db.time(row,"expires_at").isAfter(Instant.now())
        || Db.amount(row,"attempts")>=5 || !settings.mode.equals(Db.text(row,"delivery_mode")))
      return "This code is invalid or expired. Request a new one.";
    UUID id=Db.id(row,"id");
    if (!MessageDigest.isEqual(digest(id,code).getBytes(StandardCharsets.UTF_8),
        Db.text(row,"code_hash").getBytes(StandardCharsets.UTF_8))) {
      db.update("UPDATE customer_email_challenge SET attempts=attempts+1 WHERE id=?",id);
      if (Db.amount(row,"attempts")>=4) consume(id);
      return "This code is invalid or expired. Request a new one.";
    }
    return null;
  }

  private void consume(UUID id) {
    db.update("UPDATE customer_email_challenge SET consumed_at=now(),payload=NULL,code_hash='',"
        + "delivery_status=CASE WHEN delivery_status='QUEUED' THEN 'CANCELLED' ELSE delivery_status END WHERE id=?",id);
  }

  public Object verify(Actor actor,String code) {
    enabled();
    // Return failures from the transaction so failed-attempt counters commit before throwing.
    String failure=tx.execute(status -> {
      var customer=account(actor);
      var found=db.optional("SELECT * FROM customer_email_challenge WHERE customer_id=? AND purpose='VERIFY' FOR UPDATE",actor.id());
      if (found.isEmpty()) return "Request an email verification code first.";
      var challenge=found.get();
      String invalid=check(challenge,code);
      if (invalid!=null) return invalid;
      String recipient=Db.text(challenge,"recipient");
      if (!recipient.equals(Db.text(customer,"pending_email"))) return "Request a new code for your current email.";
      // Serialize claims to the same verified address. An unverified signup never reserves it.
      db.one("SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtextextended(?,0))) x","customer-email:"+recipient);
      if (db.number("SELECT count(*) FROM customer_account WHERE active AND lower(email)=?"
          + " AND email_verified_at IS NOT NULL AND id<>?",recipient,actor.id())>0) {
        consume(Db.id(challenge,"id"));
        return "This address cannot be linked. Use another address or recover your existing account.";
      }
      db.update("UPDATE customer_account SET email=?,pending_email=NULL,email_verified_at=now(),email_verification_mode=? WHERE id=?",
          recipient,settings.mode,actor.id());
      consume(Db.id(challenge,"id"));
      db.update("DELETE FROM customer_email_challenge WHERE customer_id=? AND purpose='RESET'",actor.id());
      audit(actor.id(),"LOCAL_EMAIL_VERIFIED");
      return null;
    });
    if (failure!=null) throw new Problem(400,"EMAIL_CODE_INVALID",failure);
    return Map.of("verified",true,"testOnly",true);
  }

  @Transactional
  public Object requestReset(String username,String email) {
    enabled(); String recipient=normalize(email);
    var found=db.optional("SELECT * FROM customer_account WHERE username=? AND active FOR UPDATE",Customers.username(username));
    if (found.isPresent()) {
      var row=found.get(); UUID id=Db.id(row,"id");
      if (recipient.equals(Db.text(row,"email")) && row.get("email_verified_at")!=null
          && settings.mode.equals(Db.text(row,"email_verification_mode")) && !cooling(id,"RESET"))
        queue(id,"RESET",recipient);
    }
    return Map.of("message","If these details match a verified account, a code will appear in the test inbox.","testOnly",true);
  }

  public Object reset(String username,String email,String code,String password) {
    enabled(); String recipient=normalize(email); AccountPasswords.validate(password);
    String failure=tx.execute(status -> {
      var found=db.optional("SELECT * FROM customer_account WHERE username=? AND active FOR UPDATE",Customers.username(username));
      String invalid="The account details or code are invalid or expired.";
      if (found.isEmpty()) return invalid;
      var customer=found.get(); UUID id=Db.id(customer,"id");
      var challenge=db.optional("SELECT * FROM customer_email_challenge WHERE customer_id=? AND purpose='RESET' FOR UPDATE",id);
      if (challenge.isEmpty()) return invalid;
      // Even a mismatched email cannot provide unlimited guesses against a live challenge.
      if (check(challenge.get(),code)!=null) return invalid;
      if (!recipient.equals(Db.text(customer,"email")) || !recipient.equals(Db.text(challenge.get(),"recipient"))
          || customer.get("email_verified_at")==null || !settings.mode.equals(Db.text(customer,"email_verification_mode"))) return invalid;
      db.update("UPDATE customer_account SET password_hash=?,recovery_hash='',pending_email=NULL,token_version=token_version+1 WHERE id=?",
          passwords.encode(password),id);
      db.update("UPDATE guest SET token_version=token_version+1 WHERE customer_id=?",id);
      invalidate(id);
      audit(id,"PASSWORD_RESET_BY_LOCAL_EMAIL");
      return null;
    });
    if (failure!=null) throw new Problem(400,"EMAIL_CODE_INVALID",failure);
    return Map.of("signedOut",true,"message","Password changed. Sign in and save a new recovery code.");
  }

  /** Called within account security/deletion transactions, after the account row lock. */
  public void invalidate(UUID id) { db.update("DELETE FROM customer_email_challenge WHERE customer_id=?",id); }
  private void audit(UUID id,String action) {
    db.update("INSERT INTO customer_security_event(customer_id,action) VALUES(?,?)",id,action);
  }
}
