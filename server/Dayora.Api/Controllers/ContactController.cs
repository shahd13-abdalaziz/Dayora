using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController]
[Route("api")]
public class ContactController(AppDbContext db) : ControllerBase
{
    private static readonly string[] Subjects = ["General Inquiry", "Feedback", "Technical Support", "Other"];

    /// <summary>The public "Contact us" form. Open to visitors who are not logged in.</summary>
    [HttpPost("contact"), EnableRateLimiting("contact")]
    public async Task<IActionResult> Send(ContactInput input)
    {
        if (!Subjects.Contains(input.Subject))
            throw ApiException.BadRequest("Please choose one of the listed subjects", "subject");

        db.ContactMessages.Add(new ContactMessage
        {
            Name = input.Name.Trim(),
            Email = input.Email.Trim(),
            Subject = input.Subject,
            Message = input.Message.Trim(),
        });
        await db.SaveChangesAsync();
        return StatusCode(201, new { ok = true });
    }

    [HttpGet("health")]
    public async Task<object> Health() => new { status = "ok", database = await db.Database.CanConnectAsync() };
}
