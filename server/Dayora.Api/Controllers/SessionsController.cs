using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

/// <summary>The blocks of the weekly planner.</summary>
[ApiController, Authorize]
[Route("api/sessions")]
public class SessionsController(AppDbContext db) : ControllerBase
{
    private static SessionDto ToDto(PlannerSession s) => new(s.Id, s.Title, s.Type, s.Date, s.StartHour, s.EndHour);

    /// <summary>?from=2026-10-18&amp;to=2026-10-24 (inclusive). Both optional.</summary>
    [HttpGet]
    public async Task<object> List(DateOnly? from, DateOnly? to, SessionType? type)
    {
        var uid = User.UserId();
        var q = db.Sessions.AsNoTracking().Where(s => s.UserId == uid);
        if (from is not null) q = q.Where(s => s.Date >= from);
        if (to is not null) q = q.Where(s => s.Date <= to);
        if (type is not null) q = q.Where(s => s.Type == type);
        var rows = await q.OrderBy(s => s.Date).ThenBy(s => s.StartHour).ToListAsync();
        return new { sessions = rows.Select(ToDto) };
    }

    /// <summary>The four cards on top of the planner for the week from..to.</summary>
    [HttpGet("summary")]
    public async Task<object> Summary(DateOnly from, DateOnly to, DateOnly? today)
    {
        var uid = User.UserId();
        var week = await db.Sessions.AsNoTracking()
            .Where(s => s.UserId == uid && s.Date >= from && s.Date <= to)
            .Select(s => new { s.StartHour, s.EndHour }).ToListAsync();
        var openTasks = await db.Tasks.CountAsync(t => t.UserId == uid && t.Status != TaskState.Done);
        var focusDays = await db.FocusLogs.Where(f => f.UserId == uid).Select(f => f.Date).Distinct().ToListAsync();
        var (streak, _) = Streaks.Compute(focusDays, today ?? DateOnly.FromDateTime(DateTime.Now));

        return new
        {
            plannedHours = week.Sum(s => s.EndHour - s.StartHour),
            sessions = week.Count,
            tasksToSchedule = openTasks,
            streak,
        };
    }

    [HttpPost]
    public async Task<IActionResult> Create(SessionInput input)
    {
        var uid = User.UserId();
        var session = new PlannerSession { UserId = uid };
        await Apply(session, input, uid);
        db.Sessions.Add(session);
        await db.SaveChangesAsync();
        return Created($"/api/sessions/{session.Id}", new { session = ToDto(session) });
    }

    [HttpPut("{id:int}")]
    public async Task<object> Update(int id, SessionInput input)
    {
        var uid = User.UserId();
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == uid)
                      ?? throw ApiException.NotFound("Session not found");
        await Apply(session, input, uid);
        await db.SaveChangesAsync();
        return new { session = ToDto(session) };
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var uid = User.UserId();
        var n = await db.Sessions.Where(s => s.Id == id && s.UserId == uid).ExecuteDeleteAsync();
        return n == 0 ? throw ApiException.NotFound("Session not found") : NoContent();
    }

    private async Task Apply(PlannerSession s, SessionInput input, int uid)
    {
        double start = input.StartHour!.Value, end = input.EndHour!.Value;
        // Quarter-hour steps keep the grid tidy: 9, 9.25, 9.5, 9.75 ...
        if (start < 0 || end > 24 || start % 0.25 != 0 || end % 0.25 != 0)
            throw ApiException.BadRequest("Times must be between 0 and 24, in steps of 15 minutes", "startHour");
        if (end <= start) throw ApiException.BadRequest("A session must end after it starts", "endHour");

        // One column per day on the grid: two sessions may not sit on top of each other.
        var date = input.Date!.Value;
        var clash = await db.Sessions.AnyAsync(x =>
            x.UserId == uid && x.Id != s.Id && x.Date == date && x.StartHour < end && x.EndHour > start);
        if (clash) throw new ApiException(409, "This overlaps another session on the same day", new() { ["startHour"] = "overlaps another session" });

        s.Title = input.Title.Trim();
        s.Type = input.Type!.Value;
        s.Date = date;
        s.StartHour = start;
        s.EndHour = end;
    }
}
