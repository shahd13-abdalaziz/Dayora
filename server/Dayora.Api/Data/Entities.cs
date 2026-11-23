namespace Dayora.Api.Data;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    /// <summary>Null for an account that only signs in with Google (it has no password).</summary>
    public string? PasswordHash { get; set; }
    /// <summary>Google's id for this person ("sub"). Stays the same even if they change their e-mail.</summary>
    public string? GoogleSubject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public UserSettings? Settings { get; set; }
}

public enum TaskPriority { High, Medium, Low }
public enum TaskState { Todo, Progress, Done }
public enum SessionType { Study, Project, Meeting, Review, Personal }

public class TaskItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public TaskState Status { get; set; } = TaskState.Todo;
    public DateOnly? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

/// <summary>One block on the weekly planner grid.</summary>
public class PlannerSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = "";
    public SessionType Type { get; set; }
    public DateOnly Date { get; set; }
    /// <summary>Hour of day: 13 = 1 PM, 9.5 = 9:30 AM.</summary>
    public double StartHour { get; set; }
    public double EndHour { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A finished run of the focus timer.</summary>
public class FocusLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? TaskId { get; set; }
    public int Minutes { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UserSettings
{
    public int UserId { get; set; }
    public int FocusMinutes { get; set; } = 25;
    public int ShortBreakMinutes { get; set; } = 5;
    public int LongBreakMinutes { get; set; } = 15;
    public int DailyGoalMinutes { get; set; } = 120;
}

public class ContactMessage
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
