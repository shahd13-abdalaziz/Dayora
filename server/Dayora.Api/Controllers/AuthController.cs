using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, IConfiguration config) : ControllerBase
{
    // A hash nobody can match. It is compared when the email is unknown, so "wrong email"
    // and "wrong password" take the same time and give the same answer.
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("dayora-dummy-password", 10);

    private int WorkFactor => config.GetValue("Security:BcryptWorkFactor", 11);

    private static UserDto ToDto(User u) => new(u.Id, u.Name, u.Email);

    [HttpPost("register"), EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> Register(RegisterInput input)
    {
        var email = input.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email)) throw EmailTaken();

        var user = new User
        {
            Name = input.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.Password, WorkFactor),
            Settings = new UserSettings(),
        };
        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("IX_Users_Email") == true)
        {
            // Two sign-ups with the same email at the same moment: the unique index decides.
            throw EmailTaken();
        }
        return Created("/api/auth/me", new AuthResult(tokens.Create(user), ToDto(user)));
    }

    [HttpPost("login"), EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> Login(LoginInput input)
    {
        var email = input.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        var ok = BCrypt.Net.BCrypt.Verify(input.Password, user?.PasswordHash ?? DummyHash);
        if (user is null || !ok) throw new ApiException(401, "Wrong email or password");
        return new AuthResult(tokens.Create(user), ToDto(user));
    }

    [Authorize, HttpGet("me")]
    public async Task<ActionResult<object>> Me()
    {
        var user = await db.Users.FindAsync(User.UserId()) ?? throw new ApiException(401, "Please log in first");
        return new { user = ToDto(user) };
    }

    [Authorize, HttpPut("me")]
    public async Task<ActionResult<object>> UpdateProfile(UpdateProfileInput input)
    {
        var user = await db.Users.FindAsync(User.UserId()) ?? throw new ApiException(401, "Please log in first");
        user.Name = input.Name.Trim();
        await db.SaveChangesAsync();
        return new { user = ToDto(user) };
    }

    [Authorize, HttpPut("password"), EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword(ChangePasswordInput input)
    {
        var user = await db.Users.FindAsync(User.UserId()) ?? throw new ApiException(401, "Please log in first");
        if (!BCrypt.Net.BCrypt.Verify(input.CurrentPassword, user.PasswordHash))
            throw new ApiException(403, "Current password is wrong", new() { ["currentPassword"] = "wrong password" });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.NewPassword, WorkFactor);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    /// <summary>Deletes the account and everything in it (tasks, planner, focus history, settings).</summary>
    [Authorize, HttpDelete("me"), EnableRateLimiting("auth")]
    public async Task<IActionResult> DeleteAccount(DeleteAccountInput input)
    {
        var user = await db.Users.FindAsync(User.UserId()) ?? throw new ApiException(401, "Please log in first");
        if (!BCrypt.Net.BCrypt.Verify(input.Password, user.PasswordHash))
            throw new ApiException(403, "Password is wrong", new() { ["password"] = "wrong password" });
        await db.Users.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
        return NoContent();
    }

    private static ApiException EmailTaken() =>
        new(409, "An account with this email already exists", new() { ["email"] = "already used" });
}
