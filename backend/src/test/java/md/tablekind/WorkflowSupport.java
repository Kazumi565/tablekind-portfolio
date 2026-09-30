package md.tablekind;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import md.tablekind.common.Db;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;

/** Real HTTP + SQL. Defaults to native PostgreSQL 16; external URL must be a dedicated test DB. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
abstract class WorkflowSupport {
  static final boolean SUPPLEMENTARY = "pglite".equals(System.getenv("TEST_DB_FLAVOR"));
  static PostgreSQLContainer<?> postgres;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("tablekind.pos.worker-enabled", () -> false);
    r.add("tablekind.security.rate-limits", () -> false); // Explicit limiter tests exercise limits separately.
    String external = System.getenv("TEST_DB_URL");
    if (external == null) {
      postgres = new PostgreSQLContainer<>("postgres:16-alpine");
      postgres.start();
      r.add("spring.datasource.url", postgres::getJdbcUrl);
      r.add("spring.datasource.username", postgres::getUsername);
      r.add("spring.datasource.password", postgres::getPassword);
    } else {
      r.add("spring.datasource.url", () -> external);
      r.add("spring.datasource.username", () -> System.getenv("TEST_DB_USER"));
      r.add("spring.datasource.password", () -> System.getenv("TEST_DB_PASSWORD"));
    }
    if (SUPPLEMENTARY) {
      r.add("spring.flyway.enabled", () -> false);
      r.add("spring.datasource.hikari.maximum-pool-size", () -> 1);
    }
  }

  @LocalServerPort int port;
  @Autowired ObjectMapper json;
  @Autowired Db db;
  @Autowired PlatformTransactionManager tx;
  final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  String staff, rid, bid, tid, sid, join, pid, a, b, at, bt;

  record Reply(int status, JsonNode body) {}

  Map<String, Object> map(Object... pairs) {
    var m = new LinkedHashMap<String, Object>();
    for (int i = 0; i < pairs.length; i += 2) m.put((String) pairs[i], pairs[i + 1]);
    return m;
  }

  Reply send(String token, String method, String path, Object body, String key) {
    try {
      var builder =
          HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
              .timeout(Duration.ofSeconds(20));
      if (token != null) builder.header("Authorization", "Bearer " + token);
      if (key != null) builder.header("Idempotency-Key", key);
      builder
          .header("Content-Type", "application/json")
          .method(
              method,
              body == null
                  ? HttpRequest.BodyPublishers.noBody()
                  : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
      var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
      return new Reply(
          response.statusCode(),
          response.body().isBlank() ? json.nullNode() : json.readTree(response.body()));
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  JsonNode ok(String token, String method, String path, Object body) {
    var r = send(token, method, path, body, UUID.randomUUID().toString());
    assertEquals(200, r.status(), r.body().toString());
    return r.body();
  }

  JsonNode post(String token, String path, Object body) {
    return ok(token, "POST", "/api" + path, body);
  }

  JsonNode state() {
    return ok(staff, "GET", "/api/sessions/" + sid, null);
  }

  long revision() {
    return state().path("session").path("revision").asLong();
  }

  Map<String, Object> rev(Object... fields) {
    var m = map(fields);
    m.put("revision", revision());
    return m;
  }

  JsonNode action(String token, String path, Object... fields) {
    return post(token, "/sessions/" + sid + path, rev(fields));
  }

  void fails(int status, String token, String path, Object body) {
    var r = send(token, "POST", "/api" + path, body, UUID.randomUUID().toString());
    assertEquals(status, r.status(), r.body().toString());
  }

  String item() {
    var i =
        action(
            at,
            "/orders",
            "productId",
            pid,
            "productVersion",
            1,
            "quantity",
            1,
            "optionIds",
            List.of(),
            "note",
            "");
    String id = i.path("id").asText();
    action(staff, "/orders/" + id + "/status", "status", "ACCEPTED", "reason", "");
    return id;
  }

  long due(String id) {
    for (var g : state().path("bill").path("guests"))
      if (g.path("id").asText().equals(id)) return g.path("allocated_bani").asLong();
    throw new AssertionError();
  }

  @BeforeEach
  void fixture() {
    staff =
        post(
                null,
                "/auth/login",
                map("email", "manager@tablekind.test", "password", "Local-Review-2026!"))
            .path("accessToken")
            .asText();
    rid = post(staff, "/restaurants", map("name", "Test " + UUID.randomUUID())).path("id").asText();
    bid =
        post(
                staff,
                "/restaurants/" + rid + "/branches",
                map(
                    "name",
                    "Branch",
                    "timezone",
                    "Europe/Chisinau",
                    "approvalRequired",
                    true,
                    "acceptingOrders",
                    true,
                    "hours",
                    List.of()))
            .path("id")
            .asText();
    tid =
        post(
                staff,
                "/restaurants/" + rid + "/branches/" + bid + "/tables",
                map("label", "T1", "pilotEnabled", true, "maxGuests", 20))
            .path("id")
            .asText();
    String category =
        post(
                staff,
                "/restaurants/" + rid + "/categories",
                map("names", map("en", "Food"), "sortOrder", 0))
            .path("id")
            .asText();
    pid =
        post(
                staff,
                "/restaurants/" + rid + "/products",
                map(
                    "categoryId",
                    category,
                    "names",
                    map("en", "Pizza", "ro", "Pizza", "ru", "Пицца"),
                    "descriptions",
                    map("en", "Test"),
                    "allergens",
                    List.of("milk"),
                    "dietaryLabels",
                    List.of(),
                    "priceBani",
                    10001,
                    "available",
                    true))
            .path("id")
            .asText();
    var opened = post(staff, "/restaurants/" + rid + "/tables/" + tid + "/sessions", Map.of());
    sid = opened.path("sessionId").asText();
    join = opened.path("joinToken").asText();
    var ga = post(null, "/join", map("token", join, "nickname", "Mihai"));
    a = ga.path("actorId").asText();
    at = ga.path("accessToken").asText();
    var gb = post(null, "/join", map("token", join, "nickname", "Diego"));
    b = gb.path("actorId").asText();
    bt = gb.path("accessToken").asText();
  }
}
