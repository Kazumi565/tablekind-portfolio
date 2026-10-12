package md.tablekind.demo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("hackathon")
public class DemoMenu {
  private final Menu menu;

  public DemoMenu(ObjectMapper mapper) {
    try (var input = DemoMenu.class.getResourceAsStream("/demo/menu.json")) {
      if (input == null) throw new IllegalStateException("The demo menu is missing.");
      menu = mapper.readValue(input, Menu.class);
    } catch (IOException error) {
      throw new IllegalStateException("The demo menu could not be read.", error);
    }
  }

  public List<String> categories() {
    return menu.categories();
  }

  public List<Dish> dishes() {
    return menu.items();
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Menu(List<String> categories, List<Dish> items) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Dish(
      String id,
      String name,
      String category,
      String description,
      List<String> allergens,
      List<String> dietaryLabels,
      long price,
      String image,
      int owner) {}
}
