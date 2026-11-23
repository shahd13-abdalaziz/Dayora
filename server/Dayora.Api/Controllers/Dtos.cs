using System.ComponentModel.DataAnnotations;
using Dayora.Api.Data;

namespace Dayora.Api.Controllers;

// ----- auth -----
public record RegisterInput(
    [Required, StringLength(80, MinimumLength = 2)] string Name,
    [Required, StringLength(254), EmailAddress] string Email,
    [Required, StringLength(72, MinimumLength = 6)] string Password);

public record LoginInput([Required] string Email, [Required] string Password);
public record UpdateProfileInput([Required, StringLength(80, MinimumLength = 2)] string Name);
public record ChangePasswordInput(
    [Required] string CurrentPassword,
    [Required, StringLength(72, MinimumLength = 6)] string NewPassword);
/// <summary>An account with a password confirms with the password; a Google-only account confirms by typing its e-mail.</summary>
public record DeleteAccountInput(string? Password, string? ConfirmEmail);
public record GoogleLoginInput([Required, StringLength(8000)] string Credential);

public record UserDto(int Id, string Name, string Email);
public record AuthResult(string Token, UserDto User);

// ----- tasks -----
public record TaskInput(
    [Required, StringLength(200)] string Title,
    [StringLength(2000)] string? Description,
    TaskPriority? Priority,
    TaskState? Status,
    DateOnly? DueDate);

public record TaskStatusInput([Required] TaskState? Status);

public record TaskDto(
    int Id, string Title, string Description, TaskPriority Priority, TaskState Status,
    DateOnly? DueDate, DateTime? CompletedAt);

// ----- planner sessions -----
public record SessionInput(
    [Required, StringLength(120)] string Title,
    [Required] SessionType? Type,
    [Required] DateOnly? Date,
    [Required] double? StartHour,
    [Required] double? EndHour);

public record SessionDto(int Id, string Title, SessionType Type, DateOnly Date, double StartHour, double EndHour);

// ----- focus -----
public record FocusInput(
    [Required, Range(1, 240)] int? Minutes,
    int? TaskId,
    DateOnly? Date);

public record FocusDto(int Id, int Minutes, DateOnly Date, int? TaskId, string? TaskTitle, DateTime CreatedAt);

// ----- settings -----
public record SettingsDto(
    [Range(1, 180)] int FocusMinutes,
    [Range(1, 60)] int ShortBreakMinutes,
    [Range(1, 120)] int LongBreakMinutes,
    [Range(10, 1440)] int DailyGoalMinutes);

// ----- contact -----
public record ContactInput(
    [Required, StringLength(80, MinimumLength = 2)] string Name,
    [Required, StringLength(254), EmailAddress] string Email,
    [Required, StringLength(80)] string Subject,
    [Required, StringLength(4000, MinimumLength = 10)] string Message);
