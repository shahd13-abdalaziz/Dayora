using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<PlannerSession> Sessions => Set<PlannerSession>();
    public DbSet<FocusLog> FocusLogs => Set<FocusLog>();
    public DbSet<UserSettings> Settings => Set<UserSettings>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.PasswordHash).HasMaxLength(100);
            e.HasIndex(x => x.Email).IsUnique();
            e.HasOne(x => x.Settings).WithOne().HasForeignKey<UserSettings>(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<TaskItem>(e =>
        {
            e.ToTable("Tasks");
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Description).HasMaxLength(2000);
            // Stored as readable text ('high', 'todo'...) instead of 0/1/2.
            e.Property(x => x.Priority).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.UserId, x.Status });
            e.ToTable(t =>
            {
                t.HasCheckConstraint("CK_Tasks_Priority", "[Priority] IN ('High','Medium','Low')");
                t.HasCheckConstraint("CK_Tasks_Status", "[Status] IN ('Todo','Progress','Done')");
            });
        });

        b.Entity<PlannerSession>(e =>
        {
            e.ToTable("Sessions", t =>
            {
                t.HasCheckConstraint("CK_Sessions_Hours", "[StartHour] >= 0 AND [EndHour] <= 24 AND [EndHour] > [StartHour]");
                t.HasCheckConstraint("CK_Sessions_Type", "[Type] IN ('Study','Project','Meeting','Review','Personal')");
            });
            e.Property(x => x.Title).HasMaxLength(120);
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(10);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.UserId, x.Date });
        });

        b.Entity<FocusLog>(e =>
        {
            e.ToTable("FocusLogs");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            // Deleting a task keeps the focus history, it just forgets which task it was for.
            // (NoAction on the user side avoids SQL Server's "multiple cascade paths" error.)
            e.HasOne<TaskItem>().WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(x => new { x.UserId, x.Date });
        });

        b.Entity<UserSettings>(e =>
        {
            e.ToTable("Settings");
            e.HasKey(x => x.UserId);
        });

        b.Entity<ContactMessage>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.Subject).HasMaxLength(80);
            e.Property(x => x.Message).HasMaxLength(4000);
        });
    }
}
