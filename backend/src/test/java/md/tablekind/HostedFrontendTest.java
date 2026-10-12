package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = {
    "tablekind.web.enabled=true",
    "spring.web.resources.static-locations=classpath:/hosted-ui/"
})
class HostedFrontendTest extends WorkflowSupport {
  @Test
  void frontendRoutesRemainPublicWhileApiMutationsRequireAuthentication() throws Exception {
    for (String path : List.of("/", "/manage", "/guest", "/waiter", "/admin", "/admin/settings")) {
      var response = http.send(
          HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).GET().build(),
          HttpResponse.BodyHandlers.ofString());
      assertEquals(200, response.statusCode(), path);
      assertTrue(response.body().contains("Hosted frontend routing fixture"), path);
      assertTrue(response.headers().firstValue("Content-Security-Policy").orElse("")
          .contains("frame-ancestors 'none'"));
      assertEquals("no-referrer", response.headers().firstValue("Referrer-Policy").orElse(""));
    }
    assertEquals(401, send(null, "GET", "/api/restaurants", null, null).status());
    assertEquals(401, send(null, "POST", "/api/demo/scenarios", map(), null).status());
    assertEquals(401, send(null, "POST", "/manage", map(), null).status());
    assertEquals(401, send(null, "GET", "/api/not-a-frontend-route", null, null).status());
  }
}
