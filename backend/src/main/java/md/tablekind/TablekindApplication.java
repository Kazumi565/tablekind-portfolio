package md.tablekind;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TablekindApplication {
  public static void main(String[] args) {
    SpringApplication.run(TablekindApplication.class, args);
  }
}
