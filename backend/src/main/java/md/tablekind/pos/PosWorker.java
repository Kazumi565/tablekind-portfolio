package md.tablekind.pos;

import java.util.*;
import md.tablekind.common.*;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PosWorker {
  private static final Logger log = LoggerFactory.getLogger(PosWorker.class);
  private final PosDelivery delivery;
  private final Map<String, PosConnector> connectors = new HashMap<>();
  private final Db db;
  private final boolean enabled;
  private volatile long lastSuccessfulTick;
  private volatile long lastFailure;
  private volatile long lastFailureLog;

  public Map<String, Object> health() {
    long now = System.currentTimeMillis();
    String state =
        !enabled
            ? "DISABLED"
            : lastSuccessfulTick == 0
                ? "STARTING"
                : now - lastSuccessfulTick > 30000 ? "STALE" : "RUNNING";
    return Map.of(
        "status",
        state,
        "secondsSinceSuccess",
        lastSuccessfulTick == 0 ? -1 : (now - lastSuccessfulTick) / 1000,
        "recentFailure",
        lastFailure > lastSuccessfulTick);
  }

  public PosWorker(
      PosDelivery delivery,
      Db db,
      List<PosConnector> adapters,
      @Value("${tablekind.pos.worker-enabled:true}") boolean enabled) {
    this.delivery = delivery;
    this.db = db;
    this.enabled = enabled;
    adapters.forEach(a -> connectors.put(a.name(), a));
  }

  public boolean mockAvailable() {
    return connectors.containsKey("MOCK");
  }

  public PosConnector connector(UUID rid) {
    var c = db.one("SELECT connector FROM pos_connection WHERE restaurant_id=?", rid);
    var adapter = connectors.get(Db.text(c, "connector"));
    if (adapter == null)
      throw new PosConnector.Failure(
          "No configured POS adapter is available in this profile.", false);
    return adapter;
  }

  public int drain(UUID rid, int limit) {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("POS dispatch cannot run inside a business transaction");
    int count = 0;
    for (; count < limit; count++) {
      var lease = delivery.claim(rid);
      if (lease == null) break;
      try {
        delivery.acknowledge(
            lease, connector(lease.command().restaurantId()).apply(lease.command()));
      } catch (PosConnector.Failure e) {
        delivery.failed(lease, e.getMessage(), e.retryable());
      } catch (RuntimeException e) {
        log.error(
            "POS delivery failed for message {} ({})",
            lease.command().id(),
            e.getClass().getSimpleName());
        delivery.failed(
            lease,
            "POS delivery could not be confirmed. Retrying the same command identity.",
            true);
      }
    }
    return count;
  }

  @Scheduled(fixedDelayString = "${tablekind.pos.poll-ms:2000}")
  public void tick() {
    if (!enabled) return;
    try {
      drain(null, 20);
      lastSuccessfulTick = System.currentTimeMillis();
    } catch (RuntimeException e) {
      lastFailure = System.currentTimeMillis();
      if (lastFailure - lastFailureLog >= 60000) {
        lastFailureLog = lastFailure;
        log.error("POS worker could not access its queue ({})", e.getClass().getSimpleName());
      }
    }
  }
}
