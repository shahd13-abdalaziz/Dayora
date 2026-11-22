using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController, Authorize]
[Route("api/settings")]
public class SettingsController(AppDbContext db) : ControllerBase
{
    private static SettingsDto ToDto(UserSettings s) =>
        new(s.FocusMinutes, s.ShortBreakMinutes, s.LongBreakMinutes, s.DailyGoalMinutes);

    [HttpGet]
    public async Task<object> Get() => new { settings = ToDto(await Find()) };

    [HttpPut]
    public async Task<object> Update(SettingsDto input)
    {
        var s = await Find();
        s.FocusMinutes = input.FocusMinutes;
        s.ShortBreakMinutes = input.ShortBreakMinutes;
        s.LongBreakMinutes = input.LongBreakMinutes;
        s.DailyGoalMinutes = input.DailyGoalMinutes;
        await db.SaveChangesAsync();
        return new { settings = ToDto(s) };
    }

    private async Task<UserSettings> Find()
    {
        var uid = User.UserId();
        var s = await db.Settings.FirstOrDefaultAsync(x => x.UserId == uid);
        if (s is null) { s = new UserSettings { UserId = uid }; db.Settings.Add(s); await db.SaveChangesAsync(); }
        return s;
    }
}
