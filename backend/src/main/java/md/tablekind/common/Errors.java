package md.tablekind.common;

import jakarta.servlet.http.HttpServletRequest;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import md.tablekind.restaurant.PilotMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class Errors {
  private static final Logger log = LoggerFactory.getLogger(Errors.class);
  private final PilotMetrics metrics;

  public Errors(PilotMetrics metrics) { this.metrics = metrics; }

  @ExceptionHandler(Problem.class)
  ResponseEntity<?> problem(Problem e, HttpServletRequest request) {
    if (e.status() >= 400 && e.status() != 401 && e.status() != 403) metrics.error(request);
    if (e.status() == 429)
      return ResponseEntity.status(429)
          .header("Retry-After", "60")
          .body(Map.of("status", 429, "code", e.code(), "message", e.getMessage()));
    return response(e.status(), e.code(), e.getMessage());
  }

  @ExceptionHandler({
    BindException.class,
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    IllegalArgumentException.class,
    DateTimeException.class,
    MissingRequestHeaderException.class,
    MissingServletRequestParameterException.class
  })
  ResponseEntity<?> invalid(Exception e, HttpServletRequest request) {
    metrics.error(request);
    return response(400, "INVALID_REQUEST", "Check the request fields and permitted values.");
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> constraint(DataIntegrityViolationException e, HttpServletRequest request) {
    metrics.error(request);
    return response(
        409,
        "CONSTRAINT_CONFLICT",
        "The change conflicts with an existing record or an accounting rule.");
  }

  @ExceptionHandler({
    org.springframework.dao.DataAccessResourceFailureException.class,
    org.springframework.transaction.CannotCreateTransactionException.class
  })
  ResponseEntity<?> databaseUnavailable(Exception e) {
    return ResponseEntity.status(503)
        .header("Retry-After", "5")
        .body(
            Map.of(
                "status",
                503,
                "code",
                "DATABASE_UNAVAILABLE",
                "message",
                "The database is temporarily unavailable. Keep this page open and retry the same"
                    + " request. Do not collect a payment twice."));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<?> missing(Exception e) {
    return response(404, "NOT_FOUND", "This endpoint does not exist.");
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  ResponseEntity<?> method(Exception e, HttpServletRequest request) {
    metrics.error(request);
    return response(405, "METHOD_NOT_ALLOWED", "This endpoint does not accept that method.");
  }

  @ExceptionHandler(AsyncRequestNotUsableException.class)
  void disconnectedStream(Exception e) {
    /* A disconnected SSE client cannot receive a JSON error. */
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unknown(Exception e, HttpServletRequest req) {
    metrics.error(req);
    String reference = UUID.randomUUID().toString();
    log.error(
        "Request failed reference={} path={} exception={}",
        reference,
        req.getRequestURI().replaceAll("(/api/(?:join|table-links))/[^/]+", "$1/[redacted]"),
        e.getClass().getSimpleName());
    return response(
        500, "INTERNAL_ERROR", "The change could not be completed. Reference: " + reference);
  }

  private ResponseEntity<?> response(int status, String code, String message) {
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "status",
                status,
                "code",
                code,
                "message",
                message,
                "timestamp",
                Instant.now().toString()));
  }
}
