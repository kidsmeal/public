# Discovery Playbook

Stack-specific shortcuts for the discovery phase. The scanner tells you which stack you're in;
jump to that section for where entry points, modules, config, and the golden path tend to live.
These are starting points, not guarantees — always confirm by reading the actual files.

General order of operations, regardless of stack:

1. **Read the manifest first.** It names entry points, scripts, dependencies, and the build. It's the single most information-dense file in the repo.
2. **Read the entry point(s) next.** The bootstrap file shows how the app wires itself together — what it imports, in what order, what it starts.
3. **Follow the golden path.** From an entry point, trace one real flow through the layers, opening each file as you go.
4. **Sweep the top-level dirs.** For each significant directory, open one or two representative files to learn its job.
5. **Find the cross-cutting wiring.** Search for where config is read, where logging is set up, where auth/middleware lives, where global/singleton state is defined.

---

## JavaScript / TypeScript (Node, web)

- **Manifest:** `package.json` — `main`/`module`/`exports`, `bin` (CLI entry points), `scripts` (run/test/build commands), `workspaces` (monorepo). Also `tsconfig.json` for path aliases.
- **Entry points:** `src/index.*`, `src/main.*`, `src/server.*`, `src/app.*`, framework roots (`app/` or `pages/` for Next.js, `src/main.tsx` for Vite/React, `src/main.ts` for Nest/Vue).
- **Modules:** `src/` subfolders; for frameworks, look at `routes/`, `controllers/`, `services/`, `components/`, `lib/`, `hooks/`, `store/`.
- **Cross-cutting:** middleware files, `*.config.*`, `.env*`, a `config/` dir, `logger.*`, auth guards/middleware, state stores (Redux/Zustand/Pinia).
- **Build/test:** read `scripts` in package.json; common: `npm run dev`, `npm test`, `npm run build`.

## Python

- **Manifest:** `pyproject.toml` (`[project.scripts]` = CLI entry points, `[tool.*]`), `setup.py`/`setup.cfg`, `requirements*.txt`, `Pipfile`.
- **Entry points:** `__main__.py`, `if __name__ == "__main__"`, `main.py`, `app.py`, `manage.py` (Django), `wsgi.py`/`asgi.py`, FastAPI/Flask app objects.
- **Modules:** the package dir (often `src/<pkg>/` or `<pkg>/`); Django `apps/`, `models.py`, `views.py`, `urls.py`; FastAPI `routers/`.
- **Cross-cutting:** `settings.py`/`config.py`, `conftest.py` (test fixtures), logging config, dependency-injection or app-factory functions, env loading (`python-dotenv`, `pydantic-settings`).
- **Build/test:** `pytest`, `python -m <pkg>`, `tox`, the `[project.scripts]` commands.

## Go

- **Manifest:** `go.mod` (module path, deps). `Makefile` often holds the real commands.
- **Entry points:** `func main()` in `main.go` or under `cmd/<name>/main.go` (one binary per `cmd/` subdir is the idiom).
- **Modules:** `internal/` (private packages — the real subsystems), `pkg/` (public), each package dir is a unit.
- **Cross-cutting:** `config` package, `init()` functions, middleware, a `server`/`handler` package, env via `os.Getenv` or a config lib.
- **Build/test:** `go build ./...`, `go test ./...`, `go run ./cmd/<name>`, or the Makefile targets.

## Rust

- **Manifest:** `Cargo.toml` (`[[bin]]`, `[lib]`, `[workspace]` for multi-crate, deps and features).
- **Entry points:** `fn main()` in `src/main.rs` or `src/bin/*.rs`; library root is `src/lib.rs`.
- **Modules:** `mod` declarations from `lib.rs`/`main.rs` downward; each `mod.rs` or `<name>.rs` is a unit. Workspace members in subdirs.
- **Cross-cutting:** `config.rs`, error types (often an `error.rs` with a central `Error` enum), `lib.rs` re-exports defining the public surface.
- **Build/test:** `cargo run`, `cargo test`, `cargo build --release`.

## Java / Kotlin (JVM)

- **Manifest:** `pom.xml` (Maven) or `build.gradle(.kts)` (Gradle) — modules, deps, `mainClass`.
- **Entry points:** `public static void main`, Spring Boot `@SpringBootApplication` class, `fun main()` (Kotlin).
- **Modules:** `src/main/java|kotlin/<pkg>/...`; Spring `controller`/`service`/`repository` packages; Gradle/Maven submodules.
- **Cross-cutting:** `application.properties`/`application.yml`, `@Configuration` classes, dependency-injection wiring, `@ControllerAdvice` for errors.
- **Build/test:** `./gradlew bootRun|test|build` or `mvn spring-boot:run|test|package`.

## C# / .NET

- **Manifest:** `*.csproj`/`*.sln` — target framework, packages, project references.
- **Entry points:** `Program.cs` (top-level statements or `Main`), `Startup.cs`, ASP.NET `Controllers/`, minimal-API `app.Map*` calls.
- **Modules:** project references in the solution; folders like `Services/`, `Models/`, `Controllers/`, `Data/`.
- **Cross-cutting:** `appsettings.json`, DI registration in `Program.cs`/`Startup.cs`, middleware pipeline, `DbContext`.
- **Build/test:** `dotnet run`, `dotnet test`, `dotnet build`.

## Godot (GDScript)

- **Manifest:** `project.godot` — `[application]` `run/main_scene` (the entry scene), `[autoload]` (global singletons — these are the cross-cutting systems), input map, physics engine.
- **Entry points:** the main scene from `project.godot`; autoloads run before everything.
- **Modules:** scene+script pairs grouped by folder (e.g. `enemy/`, `heroes/`, `ui/`, `systems/`); the `systems/` or autoload dir holds global services.
- **Cross-cutting:** every autoload is a cross-cutting system — list each with its role. Save/load, scene transition, object pools, global state.
- **Run/test:** open in Godot, F5 to run the main scene; test runners are usually a dedicated scene run with F6. No CLI build step beyond export presets.

## Ruby / Rails

- **Manifest:** `Gemfile`, `*.gemspec`; Rails `config/application.rb`, `config/routes.rb`.
- **Entry points:** `bin/rails`, `config.ru`, Rails `app/controllers/`; for gems, `lib/<gem>.rb`.
- **Modules:** Rails `app/{models,controllers,views,jobs,services}`; gem `lib/` tree.
- **Build/test:** `bin/rails server`, `rspec`/`rails test`, `rake`.

---

## When the stack isn't listed

Fall back to the general order at the top. The universal tells:

- The **manifest/build file** is whatever the package manager reads — find it and it names the entry points and commands.
- **Entry points** are wherever a `main`-like symbol or app-bootstrap lives; grep for `main`, `bootstrap`, `app`, `server`, `start`.
- **Cross-cutting systems** are found by searching for config reads, logger initialization, and global/singleton declarations.
- **The golden path** is always findable by starting at an entry point and following the calls.

## Large repos: parallelize

If the repo is big enough that one pass can't hold it, spawn one exploration subagent per
top-level subsystem. Give each a tight brief: "Map subsystem `X` at `path/`. Return its
charter, key files with one-line roles, public surface, and dependencies." Then assemble their
structured reports into the Modules section. This keeps each agent's context focused and lets
coverage scale with the codebase.
