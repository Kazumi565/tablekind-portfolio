package md.tablekind.common;

public class Problem extends RuntimeException {
  private final int status;
  private final String code;

  public Problem(int status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public int status() {
    return status;
  }

  public String code() {
    return code;
  }

  public static Problem bad(String message) {
    return new Problem(400, "INVALID_REQUEST", message);
  }

  public static Problem conflict(String message) {
    return new Problem(409, "CONFLICT", message);
  }

  public static Problem forbidden() {
    return new Problem(403, "FORBIDDEN", "This action is not allowed for this account.");
  }

  public static Problem missing() {
    return new Problem(404, "NOT_FOUND", "The requested resource is not available.");
  }
}
