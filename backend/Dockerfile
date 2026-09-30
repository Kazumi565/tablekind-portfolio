FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src ./src
RUN mvn -B -ntp -DskipTests package
FROM build AS tests
CMD ["mvn", "-B", "-ntp", "test"]
FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup -S tablekind && adduser -S -G tablekind tablekind
WORKDIR /app
COPY --from=build /workspace/target/tablekind-backend-0.10.2.jar app.jar
USER tablekind
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app/app.jar"]
