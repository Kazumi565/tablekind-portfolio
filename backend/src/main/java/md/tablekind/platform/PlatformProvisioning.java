package md.tablekind.platform;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import md.tablekind.auth.*;
import md.tablekind.common.*;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Local operator-only command. Never exposed as an HTTP endpoint or run on ordinary startup. */
@Component
@Order(-100)
@ConditionalOnProperty(name="tablekind.platform.provision",havingValue="true")
public class PlatformProvisioning implements ApplicationRunner {
  private final Db db;private final PasswordEncoder passwords;private final SecretBox box;
  private final PlatformTransactionManager transactions;private final ConfigurableApplicationContext context;
  public PlatformProvisioning(Db db,PasswordEncoder passwords,SecretBox box,PlatformTransactionManager transactions,ConfigurableApplicationContext context) {
    this.db=db;this.passwords=passwords;this.box=box;this.transactions=transactions;this.context=context;
  }
  @Override public void run(ApplicationArguments args) throws Exception {
    var input=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
    String email=Objects.toString(input.readLine(),"").trim().toLowerCase(Locale.ROOT);
    String password=input.readLine();
    if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || email.length()>254)
      throw new IllegalArgumentException("Supply the administrator email on the first input line.");
    AccountPasswords.validate(password);
    String secret=Totp.secret(),recovery=AccountPasswords.recoveryCode();UUID id=UUID.randomUUID();
    new TransactionTemplate(transactions).executeWithoutResult(status->{
      db.number("SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtextextended('platform-provision',0))) x");
      if(db.number("SELECT count(*) FROM platform_account")!=0)
        throw Problem.conflict("An administrator already exists. This command never replaces it.");
      db.update("INSERT INTO platform_account(id,email,password_hash,mfa_secret,recovery_hash) VALUES(?,?,?,?,?)",
          id,email,passwords.encode(password),box.seal(id,secret),Commands.hash(recovery));
      db.update("INSERT INTO platform_audit(actor_id,action,reason) VALUES(?,'ADMIN_PROVISIONED','Local operator provisioning.')",id);
    });
    System.out.println("Administrator created. Save these values privately; they are displayed once.");
    System.out.println("Authenticator secret: "+secret);
    System.out.println("Single-use recovery code: "+recovery);
    System.out.println("Add the secret to an authenticator with SHA1, 6 digits and a 30-second period.");
    System.exit(SpringApplication.exit(context,()->0));
  }
}
