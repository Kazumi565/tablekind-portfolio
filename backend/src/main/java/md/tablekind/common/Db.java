package md.tablekind.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** SQL identifiers always come from source constants; all request values are bound parameters. */
@Component
public class Db {
  public final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public Db(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public List<Map<String, Object>> list(String sql, Object... args) {
    return jdbc.query(
        sql,
        (rs, row) -> {
          Map<String, Object> result = new LinkedHashMap<>();
          for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
            Object value = rs.getObject(i);
            if (value != null && rs.getMetaData().getColumnTypeName(i).equals("jsonb"))
              value = parse(value.toString());
            if (value instanceof Timestamp t) value = t.toInstant().toString();
            result.put(rs.getMetaData().getColumnLabel(i), value);
          }
          return result;
        },
        args);
  }

  public Map<String, Object> one(String sql, Object... args) {
    return optional(sql, args).orElseThrow(Problem::missing);
  }

  public Optional<Map<String, Object>> optional(String sql, Object... args) {
    return list(sql, args).stream().findFirst();
  }

  public int update(String sql, Object... args) {
    return jdbc.update(sql, args);
  }

  public long number(String sql, Object... args) {
    Number n = jdbc.queryForObject(sql, Number.class, args);
    return n == null ? 0 : n.longValue();
  }

  public String json(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Object parse(String value) {
    try {
      return json.readValue(value, Object.class);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static UUID id(Map<String, Object> row, String key) {
    return UUID.fromString(row.get(key).toString());
  }

  public static long amount(Map<String, Object> row, String key) {
    return ((Number) row.get(key)).longValue();
  }

  public static String text(Map<String, Object> row, String key) {
    return Objects.toString(row.get(key), "");
  }

  public static boolean bool(Map<String, Object> row, String key) {
    return Boolean.TRUE.equals(row.get(key));
  }

  public static Instant time(Map<String, Object> row, String key) {
    return Instant.parse(text(row, key));
  }
}
