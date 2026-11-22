using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController, Authorize]
[Route("api/tasks")]
public class TasksController(AppDbContext db) : ControllerBase
{
    private static TaskDto ToDto(TaskItem t) =>
        new(t.Id, t.Title, t.Description, t.Priority, t.Status, t.DueDate, t.CompletedAt);

    /// <summary>All of my tasks. Optional filters: ?status=todo&amp;priority=high&amp;q=text</summary>
    [HttpGet]
    public async Task<object> List(TaskState? status, TaskPriority? priority, string? q)
    {
        var uid = User.UserId();
        var query = db.Tasks.AsNoTracking().Where(t => t.UserId == uid);
        if (status is not null) query = query.Where(t => t.Status == status);
        if (priority is not null) query = query.Where(t => t.Priority == priority);
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(t => t.Title.Contains(q.Trim()));

        var tasks = await query
            .OrderBy(t => t.Status == TaskState.Done)       // finished tasks last
            .ThenBy(t => t.DueDate == null)                 // tasks with a date before undated ones
            .ThenBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .ToListAsync();
        return new { tasks = tasks.Select(ToDto) };
    }

    [HttpGet("{id:int}")]
    public async Task<object> Get(int id) => new { task = ToDto(await Find(id, track: false)) };

    [HttpPost]
    public async Task<IActionResult> Create(TaskInput input)
    {
        var task = new TaskItem { UserId = User.UserId() };
        Apply(task, input);
        db.Tasks.Add(task);
        await db.SaveChangesAsync();
        return Created($"/api/tasks/{task.Id}", new { task = ToDto(task) });
    }

    /// <summary>Full update of a task (send all its fields).</summary>
    [HttpPut("{id:int}")]
    public async Task<object> Update(int id, TaskInput input)
    {
        var task = await Find(id);
        Apply(task, input);
        await db.SaveChangesAsync();
        return new { task = ToDto(task) };
    }

    /// <summary>Quick move between columns of the board.</summary>
    [HttpPatch("{id:int}/status")]
    public async Task<object> SetStatus(int id, TaskStatusInput input)
    {
        var task = await Find(id);
        SetState(task, input.Status!.Value);
        task.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new { task = ToDto(task) };
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var uid = User.UserId();
        if (!await db.Tasks.AnyAsync(t => t.Id == id && t.UserId == uid)) throw ApiException.NotFound("Task not found");
        // Keep the focus history, only forget which task it was for.
        // (Done here because SQL Server refuses a second cascade path from Users.)
        await db.FocusLogs.Where(f => f.TaskId == id).ExecuteUpdateAsync(s => s.SetProperty(f => f.TaskId, (int?)null));
        await db.Tasks.Where(t => t.Id == id && t.UserId == uid).ExecuteDeleteAsync();
        return NoContent();
    }

    private async Task<TaskItem> Find(int id, bool track = true)
    {
        var uid = User.UserId();
        var query = track ? db.Tasks : db.Tasks.AsNoTracking();
        // Somebody else's task looks exactly like a task that does not exist.
        return await query.FirstOrDefaultAsync(t => t.Id == id && t.UserId == uid)
               ?? throw ApiException.NotFound("Task not found");
    }

    private static void Apply(TaskItem t, TaskInput input)
    {
        t.Title = input.Title.Trim();
        t.Description = (input.Description ?? "").Trim();
        t.Priority = input.Priority ?? TaskPriority.Medium;
        t.DueDate = input.DueDate;
        SetState(t, input.Status ?? TaskState.Todo);
        t.UpdatedAt = DateTime.UtcNow;
    }

    // CompletedAt remembers when it was finished; moving it back out of "done" clears it.
    private static void SetState(TaskItem t, TaskState status)
    {
        if (status == TaskState.Done && t.Status != TaskState.Done) t.CompletedAt = DateTime.UtcNow;
        if (status != TaskState.Done) t.CompletedAt = null;
        t.Status = status;
    }
}
