namespace Dayora.Api.Infrastructure;

public static class Streaks
{
    /// <summary>
    /// current  = consecutive days with at least one focus session, ending today.
    ///            If nothing happened yet today, yesterday still counts, so the streak does not
    ///            show "0" every morning before the first session.
    /// longest  = the best run ever.
    /// </summary>
    public static (int Current, int Longest) Compute(IEnumerable<DateOnly> activeDays, DateOnly today)
    {
        var days = activeDays.Distinct().OrderBy(d => d).ToList();
        if (days.Count == 0) return (0, 0);

        int longest = 1, run = 1;
        for (var i = 1; i < days.Count; i++)
        {
            run = days[i] == days[i - 1].AddDays(1) ? run + 1 : 1;
            longest = Math.Max(longest, run);
        }

        var set = days.ToHashSet();
        var cursor = set.Contains(today) ? today : today.AddDays(-1);
        var current = 0;
        while (set.Contains(cursor)) { current++; cursor = cursor.AddDays(-1); }
        return (current, longest);
    }
}
