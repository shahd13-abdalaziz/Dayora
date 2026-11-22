using System.Text;
using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController, Authorize]
[Route("api/export")]
public class ExportController(AppDbContext db) : ControllerBase
{
    [HttpGet("tasks.csv")]
    public async Task<FileContentResult> Tasks()
    {
        var uid = User.UserId();
        var rows = await db.Tasks.AsNoTracking().Where(t => t.UserId == uid).OrderBy(t => t.Id).ToListAsync();
        return Csv("dayora-tasks.csv",
            ["Title", "Description", "Priority", "Status", "Due date", "Completed at (UTC)"],
            rows.Select(t => new[]
            {
                t.Title, t.Description, t.Priority.ToString().ToLowerInvariant(), t.Status.ToString().ToLowerInvariant(),
                t.DueDate?.ToString("yyyy-MM-dd"), t.CompletedAt?.ToString("yyyy-MM-dd HH:mm"),
            }));
    }

    [HttpGet("focus.csv")]
    public async Task<FileContentResult> Focus()
    {
        var uid = User.UserId();
        var rows = await db.FocusLogs.AsNoTracking().Where(f => f.UserId == uid).OrderBy(f => f.Id)
            .Select(f => new { f.Date, f.Minutes, Task = db.Tasks.Where(t => t.Id == f.TaskId).Select(t => t.Title).FirstOrDefault() })
            .ToListAsync();
        return Csv("dayora-focus.csv", ["Date", "Minutes", "Task"],
            rows.Select(r => new[] { r.Date.ToString("yyyy-MM-dd"), r.Minutes.ToString(), r.Task }));
    }

    private static FileContentResult Csv(string name, string[] headers, IEnumerable<string?[]> rows)
    {
        var sb = new StringBuilder("﻿"); // BOM: Excel then reads Arabic titles correctly
        sb.Append(string.Join(',', headers.Select(Cell))).Append("\r\n");
        foreach (var r in rows) sb.Append(string.Join(',', r.Select(Cell))).Append("\r\n");
        return new FileContentResult(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv; charset=utf-8") { FileDownloadName = name };
    }

    // A title like "=HYPERLINK(...)" must not run as a formula when the file opens in Excel.
    private static string Cell(string? value)
    {
        var s = value ?? "";
        if (s.Length > 0 && "=+-@\t\r".Contains(s[0])) s = "'" + s;
        return s.IndexOfAny(['"', ',', '\r', '\n']) >= 0 ? "\"" + s.Replace("\"", "\"\"") + "\"" : s;
    }
}
