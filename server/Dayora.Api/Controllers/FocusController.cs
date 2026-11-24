using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

/// <summary>The Focus Room: the client times the session and reports it here when it ends.</summary>
[ApiController, Authorize]
[Route("api/focus")]
public class FocusController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<object> Recent(int limit = 20)
    {
        var uid = User.UserId();
        limit = Math.Clamp(limit, 1, 100);
        var logs = await db.FocusLogs.AsNoTracking()
            .Where(f => f.UserId == uid)
            .OrderByDescending(f => f.Id)
            .Take(limit)
            .Select(f => new FocusDto(
                f.Id, f.Minutes, f.Date, f.TaskId,
                db.Tasks.Where(t => t.Id == f.TaskId).Select(t => t.Title).FirstOrDefault(),
                f.CreatedAt))
            .ToListAsync();
        return new { sessions = logs };
    }

    [HttpPost]
    public async Task<IActionResult> Log(FocusInput input)
    {
        var uid = User.UserId();
        if (input.TaskId is { } taskId && !await db.Tasks.AnyAsync(t => t.Id == taskId && t.UserId == uid))
            throw ApiException.BadRequest("That task does not exist", "taskId");

        var log = new FocusLog
        {
            UserId = uid,
            Minutes = input.Minutes!.Value,
            TaskId = input.TaskId,
            Date = input.Date ?? DateOnly.FromDateTime(DateTime.Now),
        };
        db.FocusLogs.Add(log);
        await db.SaveChangesAsync();
        return Created($"/api/focus/{log.Id}", new { session = new { log.Id, log.Minutes, log.Date, log.TaskId } });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var uid = User.UserId();
        var n = await db.FocusLogs.Where(f => f.Id == id && f.UserId == uid).ExecuteDeleteAsync();
        return n == 0 ? throw ApiException.NotFound("Focus session not found") : NoContent();
    }
}
