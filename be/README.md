# Kredius Backend API

REST API for the Kredius platform, built with **Spring Boot 4** + **Kotlin** following an **OpenAPI-first** design.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Java 17 / Kotlin 2.3 |
| Framework | Spring Boot 4.1 |
| API docs | SpringDoc OpenAPI (Swagger UI) |
| Code generation | OpenAPI Generator 7 (kotlin-spring) |
| Build | Maven |

---

## Prerequisites

- Java 17+
- Maven 3.9+ (or use the included `./mvnw` wrapper)

---

## Getting Started

```bash
# 1. Clone the repo
git clone <repo-url>
cd be

# 2. Generate API interfaces and model classes from the OpenAPI spec
./mvnw generate-sources

# 3. Run the application
./mvnw spring-boot:run
```

The API will be available at `http://localhost:8080`.

---

## API Documentation

Swagger UI is served automatically:

| URL | Description |
|---|---|
| `http://localhost:8080/swagger-ui.html` | Interactive API explorer |
| `http://localhost:8080/api-docs` | Raw OpenAPI JSON |

---

## OpenAPI-First Workflow

This project follows a **contract-first** approach. The OpenAPI YAML file is the single source of truth — code is generated from it, not the other way around.

### Adding or modifying an endpoint

1. **Edit the spec** — `src/main/resources/api/openapi.yaml`
2. **Regenerate** — `./mvnw generate-sources`
3. **Implement** — update or create the controller that implements the generated interface

### How generation works

```
openapi.yaml
    │
    ▼ (mvn generate-sources)
target/generated-sources/openapi/src/main/kotlin/
    ├── com/kredius/be/api/         ← Spring MVC interfaces (@RequestMapping)
    └── com/kredius/be/model/       ← Kotlin data classes
    │
    ▼ (implemented by)
src/main/kotlin/com/kredius/be/
    └── controller/                 ← Your @RestController classes
```

Controllers implement the generated interfaces:

```kotlin
@RestController
class LoanController(private val loanService: LoanService) : LoansApi {
    override fun getLoans(...): ResponseEntity<List<LoanResponse>> = ...
    override fun createLoan(...): ResponseEntity<LoanResponse> = ...
}
```

The generated interface already carries `@RequestMapping`, path parameters, and query param bindings — you only write business logic.

---

## Project Structure

```
src/
├── main/
│   ├── kotlin/com/kredius/be/
│   │   ├── config/
│   │   │   └── WebConfig.kt              # CORS configuration
│   │   ├── controller/
│   │   │   ├── HealthController.kt       # GET /health
│   │   │   └── LoanController.kt        # /api/v1/loans
│   │   ├── service/
│   │   │   └── LoanService.kt           # Business logic
│   │   ├── exception/
│   │   │   ├── ApiException.kt          # Typed API exception
│   │   │   └── GlobalExceptionHandler.kt
│   │   └── BeApplication.kt
│   └── resources/
│       ├── api/
│       │   └── openapi.yaml             # ← Edit this to change the API
│       ├── application.yml
│       └── application.properties
└── test/
    └── kotlin/com/kredius/be/
        └── BeApplicationTests.kt
```

Generated sources (not committed — in `target/`):
```
target/generated-sources/openapi/src/main/kotlin/com/kredius/be/
├── api/        ← HealthApi, LoansApi interfaces
└── model/      ← LoanResponse, CreateLoanRequest, etc.
```

---

## Available Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/loans` | List loans (filter by `status`, `page`, `size`) |
| POST | `/api/v1/loans` | Create a loan application |
| GET | `/api/v1/loans/{loanId}` | Get a loan by ID |

---

## Running Tests

```bash
./mvnw test
```

---

## Configuration

Key configuration in `src/main/resources/application.yml`:

| Property | Default | Description |
|---|---|---|
| `server.port` | `8080` | HTTP port |
| `springdoc.swagger-ui.path` | `/swagger-ui.html` | Swagger UI path |
| `springdoc.api-docs.path` | `/api-docs` | OpenAPI JSON path |
