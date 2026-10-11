package md.tablekind.restaurant;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "restaurant")
public class Restaurant {
  @Id private UUID id;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false, length = 3)
  private String currency;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected Restaurant() {}

  public Restaurant(UUID id, String name) {
    this(id, name, "MDL");
  }

  public Restaurant(UUID id, String name, String currency) {
    this.id = id;
    this.name = name;
    if (!java.util.Set.of("MDL", "EUR").contains(currency))
      throw new IllegalArgumentException("Unsupported currency");
    this.currency = currency;
    this.createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }
}
