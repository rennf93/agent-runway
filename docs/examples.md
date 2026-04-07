# Examples

Ready-to-use `.agent-runway.yml` configurations for common project types.

## Python (FastAPI)

```yaml
modules:
  app/routers/:
    purpose: "FastAPI route definitions"
    allowed:
      - "route handlers"
      - "dependency injections"
    forbidden:
      - "helper functions"
      - "business logic"
      - "data models"
      - "database queries"
  app/services/:
    purpose: "Business logic and orchestration"
    forbidden:
      - "route definitions"
      - "HTTP response handling"
  app/models/:
    purpose: "SQLAlchemy/Pydantic models"
    forbidden:
      - "business logic"
      - "route handlers"
  app/schemas/:
    purpose: "Pydantic request/response schemas"
    forbidden:
      - "business logic"
      - "database queries"
  app/utils/:
    purpose: "Shared utility functions"
    forbidden:
      - "route handlers"
      - "data models"
  tests/:
    purpose: "Test suite"
    forbidden:
      - "production code"

conventions:
  no_inline_comments:
    enabled: true
    enforcement: block
  no_noqa:
    enabled: true
    enforcement: block
  no_type_ignore:
    enabled: true
    enforcement: warn
  no_helpers_in_routers:
    enabled: true
    enforcement: block
  custom:
    - pattern: "import pdb"
      message: "Debugger import"
      enforcement: block
    - pattern: "print\\("
      message: "Use logging instead of print"
      enforcement: warn
    - pattern: "from app\\.models import.*Session"
      message: "Import Session from app.database, not models"
      enforcement: warn

context:
  extra_instructions: |
    Use uv for package management.
    Run tests with: uv run pytest
    Use Pydantic v2 model_validator, not @validator.
```

## Python (Django)

```yaml
modules:
  app/views/:
    purpose: "Django view functions and class-based views"
    forbidden:
      - "helper functions"
      - "business logic"
      - "model definitions"
  app/services/:
    purpose: "Business logic layer"
    forbidden:
      - "view definitions"
      - "URL routing"
  app/models/:
    purpose: "Django ORM models"
    forbidden:
      - "view logic"
      - "URL routing"
      - "utility functions"
  app/serializers/:
    purpose: "DRF serializers"
    forbidden:
      - "business logic"
      - "model definitions"
  app/urls/:
    purpose: "URL configuration"
    forbidden:
      - "view logic"
      - "helper functions"
  app/utils/:
    purpose: "Shared utilities"
  app/management/:
    purpose: "Management commands"
  tests/:
    purpose: "Test suite"
    forbidden:
      - "production code"

conventions:
  no_inline_comments:
    enabled: true
    enforcement: block
  no_noqa:
    enabled: true
    enforcement: block
  no_helpers_in_routers:
    enabled: true
    enforcement: block
  custom:
    - pattern: "from django\\.conf import settings"
      message: "Use dependency injection or app config, not direct settings import in business logic"
      enforcement: warn

context:
  extra_instructions: |
    Use Django 5.x patterns.
    Prefer class-based views for CRUD.
    Use DRF serializers for API endpoints.
```

## Python (Flask)

```yaml
modules:
  app/routes/:
    purpose: "Flask blueprint route definitions"
    forbidden:
      - "helper functions"
      - "business logic"
      - "database queries"
  app/services/:
    purpose: "Business logic"
    forbidden:
      - "route definitions"
  app/models/:
    purpose: "SQLAlchemy models"
    forbidden:
      - "route logic"
      - "utility functions"
  app/utils/:
    purpose: "Shared utilities"
  tests/:
    purpose: "Test suite"
    forbidden:
      - "production code"

conventions:
  no_inline_comments:
    enabled: true
    enforcement: warn
  no_noqa:
    enabled: true
    enforcement: block
  no_helpers_in_routers:
    enabled: true
    enforcement: block
```

## TypeScript (Next.js)

```yaml
modules:
  src/app/:
    purpose: "Next.js App Router pages and layouts"
    forbidden:
      - "utility functions"
      - "business logic"
      - "API client code"
  src/components/:
    purpose: "React components"
    forbidden:
      - "API calls"
      - "business logic"
      - "database queries"
  src/lib/:
    purpose: "Shared library code and utilities"
  src/services/:
    purpose: "API clients and business logic"
    forbidden:
      - "React components"
      - "UI logic"
  src/types/:
    purpose: "TypeScript type definitions"
    forbidden:
      - "runtime code"
      - "business logic"
  src/hooks/:
    purpose: "Custom React hooks"
    forbidden:
      - "API route handlers"
      - "server components"

conventions:
  no_inline_comments:
    enabled: true
    enforcement: warn
  no_lint_suppressions:
    enabled: true
    enforcement: block
  no_noqa:
    enabled: false
  no_type_ignore:
    enabled: false
  no_helpers_in_routers:
    enabled: false
  custom:
    - pattern: "console\\.log\\("
      message: "Remove console.log - use a logger"
      enforcement: warn
    - pattern: "any(?!where)"
      message: "Avoid 'any' type - use proper typing"
      enforcement: warn

context:
  extra_instructions: |
    Use Next.js 15 App Router patterns.
    Prefer Server Components by default.
    Use 'use client' only when needed.
```

## TypeScript (Express)

```yaml
modules:
  src/routes/:
    purpose: "Express route definitions"
    forbidden:
      - "helper functions"
      - "business logic"
      - "database queries"
  src/controllers/:
    purpose: "Request handlers"
    forbidden:
      - "database queries"
      - "utility functions"
  src/services/:
    purpose: "Business logic layer"
    forbidden:
      - "route definitions"
      - "HTTP response handling"
  src/models/:
    purpose: "Data models and schemas"
    forbidden:
      - "business logic"
      - "route handlers"
  src/middleware/:
    purpose: "Express middleware"
    forbidden:
      - "business logic"
      - "data models"
  src/utils/:
    purpose: "Shared utilities"
  tests/:
    purpose: "Test suite"
    forbidden:
      - "production code"

conventions:
  no_inline_comments:
    enabled: true
    enforcement: warn
  no_lint_suppressions:
    enabled: true
    enforcement: block
  custom:
    - pattern: "console\\.log\\("
      message: "Use logger instead of console.log"
      enforcement: warn
```

## Go

```yaml
modules:
  cmd/:
    purpose: "Application entry points"
    forbidden:
      - "business logic"
      - "handler functions"
  internal/handlers/:
    purpose: "HTTP handlers"
    forbidden:
      - "helper functions"
      - "business logic"
      - "database queries"
  internal/services/:
    purpose: "Business logic"
    forbidden:
      - "HTTP handlers"
      - "route definitions"
  internal/models/:
    purpose: "Data structures and types"
    forbidden:
      - "business logic"
      - "HTTP handlers"
  internal/repository/:
    purpose: "Database access layer"
    forbidden:
      - "HTTP handlers"
      - "business logic"
  pkg/:
    purpose: "Public library packages"
    forbidden:
      - "application-specific logic"

conventions:
  no_inline_comments:
    enabled: false
  no_noqa:
    enabled: false
  no_type_ignore:
    enabled: false
  no_helpers_in_routers:
    enabled: true
    enforcement: block
  custom:
    - pattern: "fmt\\.Print"
      message: "Use structured logging instead of fmt.Print"
      enforcement: warn
    - pattern: "panic\\("
      message: "Return errors instead of panicking"
      enforcement: warn

context:
  extra_instructions: |
    Follow standard Go project layout.
    Use interfaces for dependency injection.
    Return errors, don't panic.
```

## Monorepo

For monorepos, place `.agent-runway.yml` in each service directory. The scanner uses the working directory (where Claude Code is launched) as the project root.

```
monorepo/
  services/
    api/
      .agent-runway.yml       <- config for API service
      routers/
      services/
      models/
    worker/
      .agent-runway.yml       <- config for worker service
      tasks/
      handlers/
    shared/
      .agent-runway.yml       <- config for shared library
      utils/
      types/
```

When working on the API service:

```bash
cd monorepo/services/api
claude --plugin-dir /path/to/claude-agent-runway
```

The scanner will use `services/api/` as root and find its `.agent-runway.yml`.

For a top-level monorepo config that covers all services:

```yaml
modules:
  services/api/routers/:
    purpose: "API route definitions"
    forbidden:
      - "helper functions"
      - "business logic"
  services/api/services/:
    purpose: "API business logic"
  services/worker/tasks/:
    purpose: "Background task definitions"
    forbidden:
      - "HTTP handling"
  services/worker/handlers/:
    purpose: "Task event handlers"
  services/shared/utils/:
    purpose: "Shared utilities used across services"
  services/shared/types/:
    purpose: "Shared type definitions"
    forbidden:
      - "runtime code"
```
