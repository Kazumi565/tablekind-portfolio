package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import md.tablekind.billing.Money;
import md.tablekind.common.Problem;
import org.junit.jupiter.api.Test;

class MoneyTest {
  @Test
  void equalSplitsConserveEveryBanAcrossTwoToTwentyGuests() {
    for (int count = 2; count <= 20; count++) {
      var guests = new ArrayList<UUID>();
      for (int i = 0; i < count; i++) guests.add(new UUID(0, i + 1));
      for (long amount = 0; amount < 500; amount++) {
        var result = Money.equal(amount, List.copyOf(guests));
        assertEquals(amount, result.values().stream().mapToLong(Long::longValue).sum());
        assertTrue(Collections.max(result.values()) - Collections.min(result.values()) <= 1);
        Collections.reverse(guests);
        assertEquals(result, Money.equal(amount, guests));
      }
    }
  }

  @Test
  void weightedSplitsConserveTotalsAndAreIndependentOfInputOrder() {
    Random random = new Random(61);
    for (int n = 0; n < 5000; n++) {
      long amount = random.nextLong(Money.MAX);
      var weights = new LinkedHashMap<UUID, Long>();
      for (int i = 1; i <= 7; i++) weights.put(new UUID(0, i), random.nextLong(1, 10000));
      var result = Money.weighted(amount, weights);
      assertEquals(amount, result.values().stream().mapToLong(Long::longValue).sum());
      var reversed = new LinkedHashMap<UUID, Long>();
      var keys = new ArrayList<>(weights.keySet());
      Collections.reverse(keys);
      keys.forEach(k -> reversed.put(k, weights.get(k)));
      assertEquals(result, Money.weighted(amount, reversed));
      assertTrue(result.values().stream().allMatch(x -> x >= 0));
    }
  }

  @Test
  void zeroWeightDoesNotReceiveARoundingBan() {
    UUID a = new UUID(0, 1), b = new UUID(0, 2);
    assertEquals(Map.of(a, 0L, b, 1L), Money.weighted(1, Map.of(a, 0L, b, 5L)));
  }

  @Test
  void validatesInputsAndRoundsPercentagesHalfUp() {
    UUID a = UUID.randomUUID();
    assertThrows(Problem.class, () -> Money.equal(100, List.of(a, a)));
    assertThrows(Problem.class, () -> Money.equal(100, Arrays.asList(a, null)));
    assertThrows(Problem.class, () -> Money.weighted(-1, Map.of(a, 1L)));
    assertThrows(Problem.class, () -> Money.weighted(1, Map.of(a, 0L)));
    assertEquals(1, Money.percentage(5, 1000));
    assertEquals(1000, Money.percentage(10001, 1000));
  }
}
