# Dayora backend (ASP.NET Core + SQL Server)

A REST API built with **.NET 8**, **Entity Framework Core** and **SQL Server**. It also serves the website
(`pages/`, `css/`, `js/`, `imgs/`; the home page is `pages/home.html`), so one command runs everything.

## Run it

You need the [.NET 8+ SDK](https://dotnet.microsoft.com/download) and SQL Server (the **LocalDB** that comes with
Visual Studio is enough, or any SQL Server / Express).

```powershell
dotnet run --project server/Dayora.Api
```

Open <http://localhost:5000>. The first start creates the `Dayora` database and all tables by itself (EF Core
migrations), so there is nothing to set up by hand.

### Using a different SQL Server

The default connection string (in `server/Dayora.Api/appsettings.json`) uses LocalDB:

```
Server=(localdb)\MSSQLLocalDB;Database=Dayora;Trusted_Connection=True;TrustServerCertificate=True
```

To point at another server, **do not edit the committed file**. Set an environment variable instead:

```powershell
# SQL Server installed as the default instance on this PC
$env:ConnectionStrings__Default = "Server=.;Database=Dayora;Trusted_Connection=True;TrustServerCertificate=True"
# or SQL login
$env:ConnectionStrings__Default = "Server=localhost,1433;Database=Dayora;User Id=sa;Password=...;TrustServerCertificate=True"
dotnet run --project server/Dayora.Api
```

(or put the same JSON in `server/Dayora.Api/appsettings.Local.json`, which git ignores).

### Opening the pages with VS Code Live Server

That works too (port 5501): the pages talk to the API on `http://localhost:5000`, so keep `dotnet run` running.

## Tests

```powershell
dotnet test server/Dayora.Api.Tests
```

The 37 tests start the real API against a throw-away LocalDB database (created and deleted per run).

## Settings (all optional)

| Setting | Meaning | Default |
|---|---|---|
| `ConnectionStrings:Default` | SQL Server connection | LocalDB |
| `Jwt:Key` | Secret that signs login tokens (min. 32 chars). If empty, one is generated once and saved in `server/Dayora.Api/App_Data/jwt.key` (git-ignored) | generated |
| `Cors:Origins` | Extra browser origins allowed, comma separated | Live Server only |
| `RateLimit:AuthPerWindow` / `ContactPerWindow` | Requests per 15 minutes per IP on login/sign-up and on the contact form | 30 / 5 |
| `Database:MigrateOnStartup` | Apply migrations when the server starts | `true` |

Environment variables use `__` for nesting, e.g. `Jwt__Key`.

## API

All routes start with `/api`. Everything except `auth/register`, `auth/login`, `contact` and `health` needs
`Authorization: Bearer <token>` (the token comes back from register/login). Errors always look like
`{ "error": "Focus minutes must be between 1 and 180", "fields": { "focusMinutes": "must be between 1 and 180" } }`.

| Method & path | What it does |
|---|---|
| `POST /auth/register` `{name,email,password}` | Create an account â†’ `{token,user}` (409 if the email is taken) |
| `POST /auth/login` `{email,password}` | Log in â†’ `{token,user}` |
| `GET /auth/me` Â· `PUT /auth/me {name}` | Read / rename the logged-in user |
| `PUT /auth/password` `{currentPassword,newPassword}` | Change password |
| `DELETE /auth/me` `{password}` | Delete the account and all its data |
| `GET /tasks?status=&priority=&q=` | My tasks (status `todo\|progress\|done`, priority `high\|medium\|low`) |
| `POST /tasks` Â· `GET/PUT/DELETE /tasks/{id}` | Create, read, replace, delete. Body: `{title, description?, priority?, status?, dueDate?}` (`dueDate` = `2026-04-30`) |
| `PATCH /tasks/{id}/status` `{status}` | Move a task between board columns |
| `GET /sessions?from=&to=&type=` | Planner sessions (dates inclusive) |
| `POST /sessions` Â· `PUT/DELETE /sessions/{id}` | `{title, type, date, startHour, endHour}` â€” hours like `9`, `13.5`; 15-minute steps; two sessions on one day cannot overlap (409) |
| `GET /sessions/summary?from=&to=&today=` | The four planner cards: planned hours, sessions, tasks to schedule, streak |
| `GET /focus?limit=` Â· `POST /focus` Â· `DELETE /focus/{id}` | Focus-timer history. `POST {minutes (1-240), taskId?, date?}` |
| `GET /analytics?today=` | Task counts, completion rate, overdue, focus totals, last 7 days, streaks |
| `GET /dashboard?today=` | Everything the dashboard shows in one call |
| `GET /settings` Â· `PUT /settings` | Timer lengths and the daily focus goal |
| `GET /export/tasks.csv` Â· `GET /export/focus.csv` | CSV downloads |
| `POST /contact` `{name,email,subject,message}` | Public contact form (rate limited) |
| `GET /health` | `{status, database}` |

`today=YYYY-MM-DD` is optional: the browser sends its own date so streaks and "due today" follow the user's
timezone instead of the server's.

### Reading the contact-form messages

There is no admin page yet. Look at them in SQL:

```sql
SELECT Name, Email, Subject, Message, CreatedAt FROM ContactMessages ORDER BY CreatedAt DESC;
```

## Layout

```
server/
  Dayora.Api/
    Program.cs            start-up: database, JWT, rate limits, static files
    Data/                 entities + AppDbContext
    Migrations/           EF Core migrations (the database schema)
    Controllers/          one file per area (Auth, Tasks, Sessions, Focus, Analytics, ...)
    Infrastructure/       error format, token service, streak calculation
  Dayora.Api.Tests/       integration tests
```

Changing the database later: edit `Data/Entities.cs` (and `AppDbContext.cs` if needed), then

```powershell
dotnet tool restore
dotnet ef migrations add WhatYouChanged --project server/Dayora.Api --output-dir Migrations
```

The next `dotnet run` applies it.

## Security notes

* Passwords are hashed with BCrypt; wrong-email and wrong-password answers are identical.
* Every query is filtered by the logged-in user id; someone else's task looks like "not found".
* Login, sign-up and the contact form are rate limited per IP.
* Only `pages/`, `css/`, `js/` and `imgs/` are served as static files. Server code,
  the database and `.git` are not reachable over HTTP.
* The pages never put user text into HTML (they use `textContent`), so a task named `<script>` is just text.
* CSV exports neutralise spreadsheet formulas (`=HYPERLINK(...)` becomes plain text).
* This is a local/student setup: it listens on plain HTTP. Put it behind HTTPS before any real deployment.
