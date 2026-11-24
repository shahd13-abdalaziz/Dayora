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

The 52 tests start the real API against a throw-away LocalDB database (created and deleted per run).
If you use another SQL Server for the tests: `$env:DAYORA_TEST_SERVER = "."`.

## Sign in with Google (optional)

The login page shows a "Continue with Google" button **only when the server knows a Google client id**. Without
one nothing changes: the page never even contacts Google.

**One-time setup** (free, about 10 minutes, with the Gmail account that will own the app):

1. Open <https://console.cloud.google.com> and create a project (for example "Dayora").
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your e-mail.
   While the app is in *Testing*, add the Gmail addresses that may sign in under **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
4. Under **Authorized JavaScript origins** add every address the site is opened from, for example
   `http://localhost:5000`, `http://localhost:5501`, and later your real domain. No "redirect URI" is needed.
5. Copy the **Client ID** (looks like `123456-abc.apps.googleusercontent.com`). It is public by design, not a secret.
6. Give it to the server, either with an environment variable:

   ```powershell
   $env:Google__ClientId = "123456-abc.apps.googleusercontent.com"
   dotnet run --project server/Dayora.Api
   ```

   or in `server/Dayora.Api/appsettings.Local.json` (git-ignored): `{ "Google": { "ClientId": "123456-abc.apps.googleusercontent.com" } }`.

**What happens when someone clicks it:** Google asks them to pick an account and hands the page a signed token.
The page sends it to `POST /api/auth/google`; the server asks Google whether the token is real, was made for *this*
client id and has a **verified** e-mail, then logs the person in.

- First time: an account is created from their Google name and e-mail (it has no password).
- Same e-mail as an existing password account: the two are linked, the person keeps one account.
- A Google-only account can never log in with a password; deleting it asks for the account's e-mail instead of a password.

## Settings (all optional)

| Setting | Meaning | Default |
|---|---|---|
| `ConnectionStrings:Default` | SQL Server connection | LocalDB |
| `Jwt:Key` | Secret that signs login tokens (min. 32 chars). If empty, one is generated once and saved in `server/Dayora.Api/App_Data/jwt.key` (git-ignored) | generated |
| `Cors:Origins` | Extra browser origins allowed, comma separated | Live Server only |
| `RateLimit:AuthPerWindow` / `ContactPerWindow` | Requests per 15 minutes per IP on login/sign-up and on the contact form | 30 / 5 |
| `Google:ClientId` | Turns on "Continue with Google" (see the section above) | empty = off |
| `Database:MigrateOnStartup` | Apply migrations when the server starts | `true` |

Environment variables use `__` for nesting, e.g. `Jwt__Key`.

## API

All routes start with `/api`. Everything except `auth/register`, `auth/login`, `auth/google`, `auth/config`, `contact` and `health` needs
`Authorization: Bearer <token>` (the token comes back from register/login). Errors always look like
`{ "error": "Focus minutes must be between 1 and 180", "fields": { "focusMinutes": "must be between 1 and 180" } }`.

| Method & path | What it does |
|---|---|
| `POST /auth/register` `{name,email,password}` | Create an account → `{token,user}` (409 if the email is taken) |
| `POST /auth/login` `{email,password}` | Log in → `{token,user}` |
| `GET /auth/config` | `{ googleClientId }`, null when Google sign-in is not set up (the login page uses it to show or hide the button) |
| `POST /auth/google` `{credential}` | Log in with the token Google gave the browser → `{token,user}` (401 if Google refuses it or the e-mail is not verified, 503 if not set up) |
| `GET /auth/me` · `PUT /auth/me {name}` | Read / rename the logged-in user (`user` = `{id,name,email,hasPassword}`; `hasPassword` is false for Google-only accounts) |
| `PUT /auth/password` `{currentPassword,newPassword}` | Change password (400 for a Google-only account) |
| `DELETE /auth/me` `{password}` or `{confirmEmail}` | Delete the account and all its data (`confirmEmail` only for Google-only accounts) |
| `GET /tasks?status=&priority=&q=` | My tasks (status `todo\|progress\|done`, priority `high\|medium\|low`) |
| `POST /tasks` · `GET/PUT/DELETE /tasks/{id}` | Create, read, replace, delete. Body: `{title, description?, priority?, status?, dueDate?}` (`dueDate` = `2026-04-30`) |
| `PATCH /tasks/{id}/status` `{status}` | Move a task between board columns |
| `GET /sessions?from=&to=&type=` | Planner sessions (dates inclusive) |
| `POST /sessions` · `PUT/DELETE /sessions/{id}` | `{title, type, date, startHour, endHour}` — hours like `9`, `13.5`; 15-minute steps; two sessions on one day cannot overlap (409) |
| `GET /sessions/summary?from=&to=&today=` | The four planner cards: planned hours, sessions, tasks to schedule, streak |
| `GET /focus?limit=` · `POST /focus` · `DELETE /focus/{id}` | Focus-timer history. `POST {minutes (1-240), taskId?, date?}` |
| `GET /analytics?today=` | Task counts, completion rate, overdue, focus totals, last 7 days, streaks |
| `GET /dashboard?today=` | Everything the dashboard shows in one call |
| `GET /settings` · `PUT /settings` | Timer lengths and the daily focus goal |
| `GET /export/tasks.csv` · `GET /export/focus.csv` | CSV downloads |
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
