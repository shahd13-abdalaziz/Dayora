using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, IConfiguration config, IGoogleTokenValidator google) : ControllerBase
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
        // A Google-only account has no password at all: it must NEVER pass this check, whatever is typed
        // (the dummy hash above is only there to make a wrong e-mail take as long as a wrong password).
        if (user?.PasswordHash is null || !ok) throw new ApiException(401, "Wrong email or password");
        return new AuthResult(tokens.Create(user), ToDto(user));
    }

    /// <summary>
    /// What the login page needs to know: is "Sign in with Google" set up on this server?
    /// The client id is public by design (Google shows it to every visitor), it is not a secret.
    /// </summary>
    [HttpGet("config")]
    public object Config() => new { googleClientId = GoogleClientId };

    private string? GoogleClientId => string.IsNullOrWhiteSpace(config["Google:ClientId"]) ? null : config["Google:ClientId"];

    /// <summary>
    /// The login page sends the token Google gave the browser. We ask Google if it is real,
    /// then log the person in (or create their account the first time).
    /// </summary>
    [HttpPost("google"), EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResult>> GoogleLogin(GoogleLoginInput input)
    {
        var clientId = GoogleClientId ?? throw new ApiException(503, "Sign in with Google is not set up on this server");
        var who = await google.ValidateAsync(input.Credential, clientId)
                  ?? throw new ApiException(401, "Google could not confirm this sign-in. Please try again");
        // An unverified address could belong to anybody: never trust it to find or create an account.
        if (!who.EmailVerified || string.IsNullOrWhiteSpace(who.Email))
            throw new ApiException(401, "Your Google e-mail address is not verified");
        var email = who.Email.Trim().ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == who.Subject);
        if (user is null)
        {
            user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user is null)
            {
                // first time: create the account from what Google told us
                user = new User { Name = CleanName(who.Name, email), Email = email, GoogleSubject = who.Subject, Settings = new UserSettings() };
                db.Users.Add(user);
            }
            else if (user.GoogleSubject is null)
            {
                user.GoogleSubject = who.Subject;      // same e-mail as an existing account: link them, no second account
            }
            else
            {
                throw new ApiException(409, "This e-mail is already linked to a different Google account");
            }

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // two sign-ins of the same new person at the same moment: the unique indexes decide, the other one won
                db.ChangeTracker.Clear();
                user = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == who.Subject)
                       ?? throw new ApiException(409, "Could not finish the sign-in, please try again");
            }
        }
        return new AuthResult(tokens.Create(user), ToDto(user));
    }

    /// <summary>The name must be 2 to 80 characters; if Google gave none, use the part of the e-mail before the @.</summary>
    private static string CleanName(string? name, string email)
    {
        var n = (name ?? "").Trim();
        if (n.Length < 2) n = email.Split('@')[0];
        if (n.Length < 2) n = "User";
        return n.Length > 80 ? n[..80] : n;
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
        if (user.PasswordHash is null)
            throw new ApiException(400, "This account signs in with Google, so it has no password to change");
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
        if (user.PasswordHash is null)
        {
            // a Google-only account has no password: typing its own e-mail is the "are you sure?"
            if (!string.Equals(input.ConfirmEmail?.Trim(), user.Email, StringComparison.OrdinalIgnoreCase))
                throw new ApiException(403, "Type your e-mail address to confirm", new() { ["confirmEmail"] = "does not match your e-mail" });
        }
        else if (input.Password is null || !BCrypt.Net.BCrypt.Verify(input.Password, user.PasswordHash))
        {
            throw new ApiException(403, "Password is wrong", new() { ["password"] = "wrong password" });
        }
        await db.Users.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
        return NoContent();
    }

    private static ApiException EmailTaken() =>
        new(409, "An account with this email already exists", new() { ["email"] = "already used" });
}
