using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController, Authorize]
[Route("api")]
public class AnalyticsController(AppDbContext db) : ControllerBase
{
    private static DateOnly Today(DateOnly? today) => today ?? DateOnly.FromDateTime(DateTime.Now);

    /// <summary>Numbers for the Analytics page. ?today=2026-10-19 lets the browser say what "today" is for it.</summary>
    [HttpGet("analytics")]
    public async Task<object> Analytics(DateOnly? today)
    {
        var uid = User.UserId();
        var day = Today(today);

        var tasks = await db.Tasks.AsNoTracking().Where(t => t.UserId == uid)
            .Select(t => new { t.Status, t.Priority, t.DueDate }).ToListAsync();
        var total = tasks.Count;
        var done = tasks.Count(t => t.Status == TaskState.Done);

        var logs = await db.FocusLogs.AsNoTracking().Where(f => f.UserId == uid)
            .Select(f => new { f.Date, f.Minutes }).ToListAsync();
        var (streak, longest) = Streaks.Compute(logs.Select(l => l.Date), day);
        var perDay = logs.GroupBy(l => l.Date).ToDictionary(g => g.Key, g => g.Sum(l => l.Minutes));

        var last7 = Enumerable.Range(0, 7).Select(i => day.AddDays(i - 6))
            .Select(d => new { date = d, minutes = perDay.GetValueOrDefault(d) }).ToList();
        var activeDays = perDay.Count;
        var totalMinutes = logs.Sum(l => l.Minutes);

        var goal = await db.Settings.Where(s => s.UserId == uid).Select(s => s.DailyGoalMinutes).FirstOrDefaultAsync();

        return new
        {
            tasks = new
            {
                total,
                todo = tasks.Count(t => t.Status == TaskState.Todo),
                progress = tasks.Count(t => t.Status == TaskState.Progress),
                done,
                completionRate = total == 0 ? 0 : (int)Math.Round(100.0 * done / total),
                overdue = tasks.Count(t => t.Status != TaskState.Done && t.DueDate < day),
                byPriority = new
                {
                    high = tasks.Count(t => t.Priority == TaskPriority.High),
                    medium = tasks.Count(t => t.Priority == TaskPriority.Medium),
                    low = tasks.Count(t => t.Priority == TaskPriority.Low),
                },
            },
            focus = new
            {
                totalMinutes,
                sessions = logs.Count,
                todayMinutes = perDay.GetValueOrDefault(day),
                last7Minutes = last7.Sum(d => d.minutes),
                averagePerActiveDay = activeDays == 0 ? 0 : (int)Math.Round((double)totalMinutes / activeDays),
                dailyGoalMinutes = goal == 0 ? 120 : goal,
                streak,
                longestStreak = longest,
                last7Days = last7,
            },
        };
    }

    /// <summary>Everything the dashboard shows, in one request.</summary>
    [HttpGet("dashboard")]
    public async Task<object> Dashboard(DateOnly? today)
    {
        var uid = User.UserId();
        var day = Today(today);

        var user = await db.Users.AsNoTracking().Where(u => u.Id == uid).Select(u => new UserDto(u.Id, u.Name, u.Email, u.PasswordHash != null)).FirstAsync();
        var open = db.Tasks.AsNoTracking().Where(t => t.UserId == uid && t.Status != TaskState.Done);

        var upcoming = await open
            .OrderBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenBy(t => t.Id)
            .Take(5)
            .Select(t => new TaskDto(t.Id, t.Title, t.Description, t.Priority, t.Status, t.DueDate, t.CompletedAt))
            .ToListAsync();

        var todaySessions = await db.Sessions.AsNoTracking()
            .Where(s => s.UserId == uid && s.Date == day)
            .OrderBy(s => s.StartHour)
            .Select(s => new SessionDto(s.Id, s.Title, s.Type, s.Date, s.StartHour, s.EndHour))
            .ToListAsync();

        var focusDays = await db.FocusLogs.Where(f => f.UserId == uid).Select(f => f.Date).Distinct().ToListAsync();
        var (streak, _) = Streaks.Compute(focusDays, day);
        var todayMinutes = await db.FocusLogs.Where(f => f.UserId == uid && f.Date == day).SumAsync(f => (int?)f.Minutes) ?? 0;
        var goal = await db.Settings.Where(s => s.UserId == uid).Select(s => s.DailyGoalMinutes).FirstOrDefaultAsync();

        return new
        {
            user,
            counts = new
            {
                open = await open.CountAsync(),
                dueToday = await open.CountAsync(t => t.DueDate == day),
                overdue = await open.CountAsync(t => t.DueDate < day),
                done = await db.Tasks.CountAsync(t => t.UserId == uid && t.Status == TaskState.Done),
            },
            focus = new { todayMinutes, dailyGoalMinutes = goal == 0 ? 120 : goal, streak },
            upcomingTasks = upcoming,
            todaySessions,
        };
    }
}
