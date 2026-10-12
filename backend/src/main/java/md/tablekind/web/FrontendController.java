package md.tablekind.web;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@ConditionalOnProperty(name = "tablekind.web.enabled", havingValue = "true")
public class FrontendController {
  @GetMapping({"/manage", "/guest", "/waiter", "/admin", "/admin/{*path}"})
  public String frontend() {
    return "forward:/index.html";
  }
}
