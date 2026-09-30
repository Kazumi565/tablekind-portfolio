package md.tablekind.customer;

import java.util.UUID;
import md.tablekind.auth.SecretBox;
import md.tablekind.common.Db;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Bounded local SMTP retries. A crash after SMTP acceptance may redeliver the same code. */
@Component
public class EmailWorker {
  private final EmailSettings settings;
  private final Db db;
  private final SecretBox box;
  private final LocalEmailDelivery delivery;
  private final TransactionTemplate tx;

  public EmailWorker(EmailSettings settings, Db db, SecretBox box, LocalEmailDelivery delivery,
      PlatformTransactionManager manager) {
    this.settings=settings; this.db=db; this.box=box; this.delivery=delivery;
    tx=new TransactionTemplate(manager);
  }

  @Scheduled(fixedDelayString="${tablekind.email.worker-delay-ms:3000}")
  public void tick() { if (settings.enabled() && settings.workerEnabled) deliverOne(); }

  public boolean deliverOne() {
    if (!settings.enabled()) return false;
    return Boolean.TRUE.equals(tx.execute(status -> {
      // Remove expired secret material regardless of the delivery outcome.
      db.update("WITH expired AS (SELECT id FROM customer_email_challenge WHERE expires_at<=now()"
          + " AND (payload IS NOT NULL OR code_hash<>'') ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)"
          + " UPDATE customer_email_challenge SET payload=NULL,code_hash='',consumed_at=coalesce(consumed_at,now()),"
          + "delivery_status=CASE WHEN delivery_status='QUEUED' THEN 'CANCELLED' ELSE delivery_status END"
          + " WHERE id IN (SELECT id FROM expired)");
      var candidate=db.optional("SELECT * FROM customer_email_challenge WHERE delivery_status='QUEUED'"
          + " AND consumed_at IS NULL AND expires_at>now() AND next_attempt_at<=now()"
          + " ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED");
      if (candidate.isEmpty()) return false;
      var row=candidate.get(); UUID id=Db.id(row,"id");
      int attempt=(int)Db.amount(row,"delivery_attempts")+1;
      try {
        delivery.send(Db.text(row,"recipient"),Db.text(row,"purpose"),box.open(id,Db.text(row,"payload")));
        db.update("UPDATE customer_email_challenge SET delivery_status='SENT',payload=NULL,delivery_attempts=? WHERE id=?",attempt,id);
      } catch (RuntimeException failure) {
        // Exception messages from SMTP may contain recipient data. Store status only.
        db.update("UPDATE customer_email_challenge SET delivery_attempts=?,delivery_status=?,"
            + "next_attempt_at=now()+(? * interval '1 second'),payload=CASE WHEN ? THEN NULL ELSE payload END WHERE id=?",
            attempt,attempt>=5 ? "FAILED" : "QUEUED",Math.min(60,attempt*10),attempt>=5,id);
      }
      return true;
    }));
  }
}
