using System.Net;
using System.Net.Http.Json;
using System.Text;
using Dayora.Api.Infrastructure;
using Xunit;

namespace Dayora.Api.Tests;

public class ApiTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public ApiTests(TestApp app) => _app = app;

    // ---------------- auth ----------------

    [Fact]
    public async Task Register_login_and_me_work_and_email_is_case_insensitive()
    {
        var (_, email) = await _app.NewUserAsync();
        var anon = _app.CreateClient();

        var login = await anon.PostAsJsonAsync("/api/auth/login", new { email = email.ToUpperInvariant(), password = "secret1" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var dup = await anon.PostAsJsonAsync("/api/auth/register", new { name = "Again", email = email.ToUpperInvariant(), password = "secret1" });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
    }

    [Fact]
    public async Task Wrong_password_and_unknown_email_give_the_same_answer()
    {
        var (_, email) = await _app.NewUserAsync();
        var anon = _app.CreateClient();
        var wrongPassword = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "nope-nope" });
        var unknownEmail = await anon.PostAsJsonAsync("/api/auth/login", new { email = "nobody@test.com", password = "nope-nope" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal((await wrongPassword.Body()).GetProperty("error").GetString(), (await unknownEmail.Body()).GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("/api/tasks")]
    [InlineData("/api/sessions")]
    [InlineData("/api/focus")]
    [InlineData("/api/analytics")]
    [InlineData("/api/dashboard")]
    [InlineData("/api/settings")]
    [InlineData("/api/export/tasks.csv")]
    public async Task Private_endpoints_need_a_login(string url)
    {
        var res = await _app.CreateClient().GetAsync(url);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Register_rejects_bad_input_with_field_messages()
    {
        var res = await _app.CreateClient().PostAsJsonAsync("/api/auth/register", new { name = "A", email = "not-an-email", password = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var fields = (await res.Body()).GetProperty("fields");
        Assert.True(fields.TryGetProperty("name", out _));
        Assert.True(fields.TryGetProperty("email", out _));
        Assert.True(fields.TryGetProperty("password", out _));
    }

    [Fact]
    public async Task Deleting_the_account_removes_everything_and_kills_the_token()
    {
        var (c, _) = await _app.NewUserAsync();
        var task = await (await c.PostAsJsonAsync("/api/tasks", new { title = "x" })).Body();
        var taskId = task.GetProperty("task").GetProperty("id").GetInt32();
        await c.PostAsJsonAsync("/api/focus", new { minutes = 20, taskId });   // history that points at the task
        await c.PostAsJsonAsync("/api/sessions", new { title = "s", type = "study", date = "2026-11-22", startHour = 9, endHour = 10 });

        var wrong = await c.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/auth/me") { Content = JsonContent.Create(new { password = "wrong-one" }) });
        Assert.Equal(HttpStatusCode.Forbidden, wrong.StatusCode);

        var del = await c.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/auth/me") { Content = JsonContent.Create(new { password = "secret1" }) });
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/tasks")).StatusCode);
    }

    // ---------------- tasks ----------------

    [Fact]
    public async Task Task_lifecycle_and_completedAt()
    {
        var (c, _) = await _app.NewUserAsync();
        var created = await c.PostAsJsonAsync("/api/tasks", new { title = "  Write docs  ", priority = "high", dueDate = "2026-11-25" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var t = (await created.Body()).GetProperty("task");
        Assert.Equal("Write docs", t.GetProperty("title").GetString());   // trimmed
        Assert.Equal("todo", t.GetProperty("status").GetString());
        var id = t.GetProperty("id").GetInt32();

        var done = await (await c.PatchAsJsonAsync($"/api/tasks/{id}/status", new { status = "done" })).Body();
        Assert.NotEqual(System.Text.Json.JsonValueKind.Null, done.GetProperty("task").GetProperty("completedAt").ValueKind);

        var back = await (await c.PatchAsJsonAsync($"/api/tasks/{id}/status", new { status = "progress" })).Body();
        Assert.Equal(System.Text.Json.JsonValueKind.Null, back.GetProperty("task").GetProperty("completedAt").ValueKind);

        var upd = await c.PutAsJsonAsync($"/api/tasks/{id}", new { title = "New", priority = "low", status = "todo", dueDate = (string?)null });
        Assert.Equal(HttpStatusCode.OK, upd.StatusCode);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, (await upd.Body()).GetProperty("task").GetProperty("dueDate").ValueKind);

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/tasks/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/tasks/{id}")).StatusCode);
    }

    [Fact]
    public async Task Task_validation_reports_the_bad_field()
    {
        var (c, _) = await _app.NewUserAsync();
        var res = await c.PostAsJsonAsync("/api/tasks", new { title = "ok", priority = "urgent" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Body();
        var fields = body.GetProperty("fields");
        Assert.True(fields.TryGetProperty("priority", out _));
        Assert.False(fields.TryGetProperty("input", out _));

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/tasks", new { title = "   " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/tasks", new { title = "x", dueDate = "2026-13-45" })).StatusCode);
    }

    [Fact]
    public async Task Users_cannot_see_touch_or_delete_each_others_tasks()
    {
        var (a, _) = await _app.NewUserAsync();
        var (b, _) = await _app.NewUserAsync();
        var id = (await (await a.PostAsJsonAsync("/api/tasks", new { title = "private" })).Body()).GetProperty("task").GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/tasks/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PutAsJsonAsync($"/api/tasks/{id}", new { title = "hacked" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PatchAsJsonAsync($"/api/tasks/{id}/status", new { status = "done" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.DeleteAsync($"/api/tasks/{id}")).StatusCode);
        Assert.Empty((await (await b.GetAsync("/api/tasks")).Body()).GetProperty("tasks").EnumerateArray());

        // ...and it is still intact for the owner
        Assert.Equal("private", (await (await a.GetAsync($"/api/tasks/{id}")).Body()).GetProperty("task").GetProperty("title").GetString());
    }

    [Fact]
    public async Task Search_treats_percent_and_underscore_literally()
    {
        var (c, _) = await _app.NewUserAsync();
        await c.PostAsJsonAsync("/api/tasks", new { title = "Reach 100% coverage" });
        await c.PostAsJsonAsync("/api/tasks", new { title = "Something else" });
        var tasks = (await (await c.GetAsync("/api/tasks?q=%25")).Body()).GetProperty("tasks");
        Assert.Single(tasks.EnumerateArray());
    }

    // ---------------- planner ----------------

    [Fact]
    public async Task Sessions_cannot_overlap_but_can_touch()
    {
        var (c, _) = await _app.NewUserAsync();
        object S(string title, double s, double e) => new { title, type = "study", date = "2026-11-22", startHour = s, endHour = e };

        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/sessions", S("a", 9, 11))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync("/api/sessions", S("clash", 10, 12))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/sessions", S("next", 11, 12.5))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/sessions", S("backwards", 15, 14))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/sessions", S("odd", 9.1, 9.7))).StatusCode);

        // another user may use the same hours
        var (d, _) = await _app.NewUserAsync();
        Assert.Equal(HttpStatusCode.Created, (await d.PostAsJsonAsync("/api/sessions", S("mine", 9, 11))).StatusCode);
    }

    [Fact]
    public async Task Moving_a_session_does_not_clash_with_itself()
    {
        var (c, _) = await _app.NewUserAsync();
        var created = await (await c.PostAsJsonAsync("/api/sessions", new { title = "a", type = "study", date = "2026-11-22", startHour = 9, endHour = 11 })).Body();
        var id = created.GetProperty("session").GetProperty("id").GetInt32();
        var res = await c.PutAsJsonAsync($"/api/sessions/{id}", new { title = "a", type = "review", date = "2026-11-22", startHour = 10, endHour = 12 });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Week_summary_adds_up_the_hours()
    {
        var (c, _) = await _app.NewUserAsync();
        await c.PostAsJsonAsync("/api/sessions", new { title = "a", type = "study", date = "2026-11-22", startHour = 9, endHour = 11 });
        await c.PostAsJsonAsync("/api/sessions", new { title = "b", type = "study", date = "2026-11-23", startHour = 13, endHour = 14.5 });
        await c.PostAsJsonAsync("/api/sessions", new { title = "outside the week", type = "study", date = "2026-12-30", startHour = 9, endHour = 10 });
        await c.PostAsJsonAsync("/api/tasks", new { title = "t" });

        var s = await (await c.GetAsync("/api/sessions/summary?from=2026-11-22&to=2026-11-28&today=2026-11-22")).Body();
        Assert.Equal(3.5, s.GetProperty("plannedHours").GetDouble());
        Assert.Equal(2, s.GetProperty("sessions").GetInt32());
        Assert.Equal(1, s.GetProperty("tasksToSchedule").GetInt32());
    }

    // ---------------- focus + analytics ----------------

    [Fact]
    public async Task Focus_feeds_the_streak_and_the_dashboard()
    {
        var (c, _) = await _app.NewUserAsync();
        foreach (var day in new[] { "2026-11-20", "2026-11-21", "2026-11-22" })
            await c.PostAsJsonAsync("/api/focus", new { minutes = 25, date = day });
        await c.PostAsJsonAsync("/api/focus", new { minutes = 25, date = "2026-11-10" });

        var a = await (await c.GetAsync("/api/analytics?today=2026-11-22")).Body();
        var focus = a.GetProperty("focus");
        Assert.Equal(3, focus.GetProperty("streak").GetInt32());
        Assert.Equal(100, focus.GetProperty("totalMinutes").GetInt32());
        Assert.Equal(7, focus.GetProperty("last7Days").GetArrayLength());

        var d = await (await c.GetAsync("/api/dashboard?today=2026-11-22")).Body();
        Assert.Equal(25, d.GetProperty("focus").GetProperty("todayMinutes").GetInt32());
    }

    [Fact]
    public async Task Focus_rejects_someone_elses_task_and_nonsense_minutes()
    {
        var (a, _) = await _app.NewUserAsync();
        var (b, _) = await _app.NewUserAsync();
        var id = (await (await a.PostAsJsonAsync("/api/tasks", new { title = "mine" })).Body()).GetProperty("task").GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.BadRequest, (await b.PostAsJsonAsync("/api/focus", new { minutes = 25, taskId = id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/focus", new { minutes = 0 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/focus", new { minutes = 9999 })).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_task_keeps_the_focus_history()
    {
        var (c, _) = await _app.NewUserAsync();
        var id = (await (await c.PostAsJsonAsync("/api/tasks", new { title = "gone soon" })).Body()).GetProperty("task").GetProperty("id").GetInt32();
        await c.PostAsJsonAsync("/api/focus", new { minutes = 30, taskId = id });
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/tasks/{id}")).StatusCode);

        var list = (await (await c.GetAsync("/api/focus")).Body()).GetProperty("sessions");
        Assert.Equal(1, list.GetArrayLength());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, list[0].GetProperty("taskId").ValueKind);
    }

    [Fact]
    public async Task Analytics_counts_tasks_and_overdue()
    {
        var (c, _) = await _app.NewUserAsync();
        await c.PostAsJsonAsync("/api/tasks", new { title = "late", dueDate = "2026-11-01" });
        await c.PostAsJsonAsync("/api/tasks", new { title = "done one", status = "done", priority = "low" });
        await c.PostAsJsonAsync("/api/tasks", new { title = "going", status = "progress", priority = "high" });

        var t = (await (await c.GetAsync("/api/analytics?today=2026-11-22")).Body()).GetProperty("tasks");
        Assert.Equal(3, t.GetProperty("total").GetInt32());
        Assert.Equal(1, t.GetProperty("done").GetInt32());
        Assert.Equal(33, t.GetProperty("completionRate").GetInt32());
        Assert.Equal(1, t.GetProperty("overdue").GetInt32());
    }

    // ---------------- settings, export, contact, static ----------------

    [Fact]
    public async Task Settings_have_defaults_validate_and_persist()
    {
        var (c, _) = await _app.NewUserAsync();
        var s = (await (await c.GetAsync("/api/settings")).Body()).GetProperty("settings");
        Assert.Equal(25, s.GetProperty("focusMinutes").GetInt32());

        var bad = await c.PutAsJsonAsync("/api/settings", new { focusMinutes = 0, shortBreakMinutes = 5, longBreakMinutes = 15, dailyGoalMinutes = 60 });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var badBody = await bad.Body();
        Assert.Equal("must be between 1 and 180", badBody.GetProperty("fields").GetProperty("focusMinutes").GetString());
        Assert.Equal("Focus minutes must be between 1 and 180", badBody.GetProperty("error").GetString());

        await c.PutAsJsonAsync("/api/settings", new { focusMinutes = 40, shortBreakMinutes = 10, longBreakMinutes = 20, dailyGoalMinutes = 90 });
        var after = (await (await c.GetAsync("/api/settings")).Body()).GetProperty("settings");
        Assert.Equal(40, after.GetProperty("focusMinutes").GetInt32());
    }

    [Fact]
    public async Task Csv_export_neutralises_spreadsheet_formulas_and_quotes_commas()
    {
        var (c, _) = await _app.NewUserAsync();
        await c.PostAsJsonAsync("/api/tasks", new { title = "=HYPERLINK(\"http://evil\")" });
        await c.PostAsJsonAsync("/api/tasks", new { title = "plain, with comma" });
        var res = await c.GetAsync("/api/export/tasks.csv");
        Assert.Equal("text/csv", res.Content.Headers.ContentType!.MediaType);
        var csv = Encoding.UTF8.GetString(await res.Content.ReadAsByteArrayAsync());
        Assert.Contains("'=HYPERLINK", csv);
        Assert.DoesNotContain(",=HYPERLINK", csv);
        Assert.Contains("\"plain, with comma\"", csv);
    }

    [Fact]
    public async Task Contact_form_saves_validates_and_is_rate_limited()
    {
        var anon = _app.CreateClient();
        var ok = new { name = "Visitor", email = "v@x.com", subject = "Feedback", message = "Hello there, team" };
        Assert.Equal(HttpStatusCode.Created, (await anon.PostAsJsonAsync("/api/contact", ok)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anon.PostAsJsonAsync("/api/contact", new { name = "V", email = "bad", subject = "Feedback", message = "short" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anon.PostAsJsonAsync("/api/contact", new { name = "Visitor", email = "v@x.com", subject = "Not a subject", message = "Hello there, team" })).StatusCode);
        // limit is 3 per window in tests: 1 ok + 2 rejected-by-validation already used it up
        Assert.Equal(HttpStatusCode.TooManyRequests, (await anon.PostAsJsonAsync("/api/contact", ok)).StatusCode);
    }

    [Theory]
    [InlineData("/", HttpStatusCode.OK)]                  // redirects to pages/home.html
    [InlineData("/pages/home.html", HttpStatusCode.OK)]
    [InlineData("/index.html", HttpStatusCode.NotFound)]
    [InlineData("/pages/login.html", HttpStatusCode.OK)]
    [InlineData("/css/style.css", HttpStatusCode.OK)]
    [InlineData("/server/Dayora.Api/appsettings.json", HttpStatusCode.NotFound)]
    [InlineData("/.git/config", HttpStatusCode.NotFound)]
    [InlineData("/Dayora.sln", HttpStatusCode.NotFound)]
    public async Task Website_files_are_served_but_server_files_are_not(string path, HttpStatusCode expected)
    {
        var res = await _app.CreateClient().GetAsync(path);
        Assert.Equal(expected, res.StatusCode);
    }

    [Fact]
    public async Task Unknown_api_path_is_json_404()
    {
        var res = await _app.CreateClient().GetAsync("/api/nope");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("application/json", res.Content.Headers.ContentType!.MediaType);
    }
}

public class StreakTests
{
    private static DateOnly D(int day) => new(2026, 11, day);

    [Fact] public void No_activity_is_zero() => Assert.Equal((0, 0), Streaks.Compute([], D(22)));
    [Fact] public void Counts_consecutive_days_ending_today() => Assert.Equal((3, 3), Streaks.Compute([D(20), D(21), D(22)], D(22)));
    [Fact] public void Yesterday_keeps_the_streak_alive() => Assert.Equal((2, 2), Streaks.Compute([D(20), D(21)], D(22)));
    [Fact] public void A_gap_resets_the_current_streak_but_remembers_the_best() => Assert.Equal((0, 3), Streaks.Compute([D(10), D(11), D(12)], D(22)));
    [Fact] public void Duplicate_days_count_once() => Assert.Equal((1, 1), Streaks.Compute([D(22), D(22), D(22)], D(22)));
}
