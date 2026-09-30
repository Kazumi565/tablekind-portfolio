package md.tablekind.billing;

import java.math.BigInteger;
import java.util.*;
import md.tablekind.common.Problem;

/** Integer minor units. Largest remainders, then stable guest ID, decide every last ban. */
public final class Money {
  public static final long MAX = 1_000_000_000L;

  private Money() {}

  public static Map<UUID, Long> weighted(long total, Map<UUID, Long> weights) {
    if (total < 0
        || total > MAX
        || weights == null
        || weights.isEmpty()
        || weights.size() > 200
        || weights.values().stream().anyMatch(w -> w == null || w < 0 || w > MAX))
      throw Problem.bad("Invalid split amount or weights.");
    long sum = weights.values().stream().mapToLong(Long::longValue).sum();
    if (sum == 0) throw Problem.bad("At least one share must have a positive weight.");
    record Fraction(UUID id, long value, BigInteger remainder) {}
    List<Fraction> fractions = new ArrayList<>();
    long assigned = 0;
    for (var e : weights.entrySet()) {
      var qr =
          BigInteger.valueOf(total)
              .multiply(BigInteger.valueOf(e.getValue()))
              .divideAndRemainder(BigInteger.valueOf(sum));
      long base = qr[0].longValueExact();
      assigned += base;
      fractions.add(new Fraction(e.getKey(), base, qr[1]));
    }
    fractions.sort(
        Comparator.comparing(Fraction::remainder).reversed().thenComparing(f -> f.id().toString()));
    Map<UUID, Long> result = new TreeMap<>(Comparator.comparing(UUID::toString));
    long extra = total - assigned;
    for (int i = 0; i < fractions.size(); i++) {
      var f = fractions.get(i);
      result.put(f.id(), f.value() + (i < extra ? 1 : 0));
    }
    return result;
  }

  public static Map<UUID, Long> equal(long amount, List<UUID> guests) {
    if (guests == null
        || guests.isEmpty()
        || guests.size() > 20
        || new HashSet<>(guests).size() != guests.size()
        || guests.stream().anyMatch(Objects::isNull))
      throw Problem.bad("Select one to twenty different guests.");
    Map<UUID, Long> w = new LinkedHashMap<>();
    guests.forEach(g -> w.put(g, 1L));
    return weighted(amount, w);
  }

  public static long percentage(long amount, int bps) {
    if (amount < 0 || amount > MAX || bps < 0 || bps > 10000)
      throw Problem.bad("Invalid percentage.");
    return BigInteger.valueOf(amount)
        .multiply(BigInteger.valueOf(bps))
        .add(BigInteger.valueOf(5000))
        .divide(BigInteger.valueOf(10000))
        .longValueExact();
  }
}
