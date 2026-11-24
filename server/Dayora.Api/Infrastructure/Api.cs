using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace Dayora.Api.Infrastructure;

/// <summary>Throw this from anywhere in a controller to answer with a clean JSON error.</summary>
public class ApiException(int status, string message, Dictionary<string, string>? fields = null) : Exception(message)
{
    public int Status { get; } = status;
    public Dictionary<string, string>? Fields { get; } = fields;

    public static ApiException BadRequest(string message, string? field = null) =>
        new(400, message, field is null ? null : new() { [field] = message });
    public static ApiException NotFound(string what) => new(404, what);
}

/// <summary>Every error leaves the API as { "error": "...", "fields": { "name": "..." } }.</summary>
public class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> log)
{
    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (ApiException ex)
        {
            await Write(ctx, ex.Status, ex.Message, ex.Fields);
        }
        catch (BadHttpRequestException)
        {
            await Write(ctx, 400, "The request body is not valid JSON", null);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Unhandled error on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, 500, "Something went wrong on the server", null);
        }
    }

    public static async Task Write(HttpContext ctx, int status, string message, Dictionary<string, string>? fields)
    {
        if (ctx.Response.HasStarted) return;
        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(
            new { error = message, fields },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }));
    }
}

public static class ApiExtensions
{
    public static int UserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new ApiException(401, "Please log in first"));

    /// <summary>Turns [Required]/[StringLength]/enum-binding failures into our { error, fields } shape.</summary>
    public static IMvcBuilder UseDayoraValidationErrors(this IMvcBuilder builder) =>
        builder.ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
        {
            var fields = new Dictionary<string, string>();
            var bodyParameters = ctx.ActionDescriptor.Parameters.Select(p => p.Name).ToHashSet();
            var hasSpecificError = ctx.ModelState.Any(kv => kv.Value?.Errors.Count > 0 && !bodyParameters.Contains(kv.Key));
            foreach (var (key, entry) in ctx.ModelState)
            {
                if (entry.Errors.Count == 0) continue;
                // When the JSON could not be read, MVC also adds "the body is required".
                // That only repeats the real problem, so leave it out.
                if (hasSpecificError && bodyParameters.Contains(key)) continue;
                var name = string.IsNullOrEmpty(key) ? "body" : char.ToLowerInvariant(key.TrimStart('$', '.')[0]) + key.TrimStart('$', '.')[1..];
                fields[name] = Friendly(entry.Errors[0].ErrorMessage);
            }
            var first = fields.Count > 0 ? $"{Humanize(fields.First().Key)} {fields.First().Value}" : "Invalid request";
            return new ObjectResult(new { error = first, fields }) { StatusCode = 400 };
        });

    /// <summary>"focusMinutes" -> "Focus minutes"</summary>
    private static string Humanize(string name)
    {
        var spaced = System.Text.RegularExpressions.Regex.Replace(name, "(?<=[a-z])(?=[A-Z])", " ").ToLowerInvariant();
        return spaced.Length == 0 ? "Request" : char.ToUpperInvariant(spaced[0]) + spaced[1..];
    }

    /// <summary>
    /// .NET's built-in texts name the C# property ("The field FocusMinutes must be between 1 and 180.").
    /// Cut them down to what the screen needs next to the field: "must be between 1 and 180".
    /// </summary>
    private static string Friendly(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return "has an invalid value";
        // The binder's technical texts: "The JSON value could not be converted to ..."
        if (message.StartsWith("The JSON value") || message.StartsWith("The input was not valid") || message.Contains("could not be converted"))
            return "has an invalid value";
        if (message.Contains("is not a valid e-mail")) return "must be a valid email address";
        if (message.EndsWith(" field is required.")) return "is required";

        var between = System.Text.RegularExpressions.Regex.Match(message, @"must be between (\d+) and (\d+)");
        if (between.Success) return $"must be between {between.Groups[1].Value} and {between.Groups[2].Value}";

        var length = System.Text.RegularExpressions.Regex.Match(message, @"minimum length of (\d+) and a maximum length of (\d+)");
        if (length.Success) return $"must be {length.Groups[1].Value} to {length.Groups[2].Value} characters";

        var max = System.Text.RegularExpressions.Regex.Match(message, @"maximum length of '?(\d+)");
        if (max.Success) return $"must be at most {max.Groups[1].Value} characters";

        return message;
    }
}

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "dayora";
    public int ExpiresDays { get; set; } = 7;
}

/// <summary>Creates the signing key once and keeps it in App_Data, so no secret is ever committed.</summary>
public static class JwtKey
{
    public static string Resolve(IConfiguration config, string contentRoot)
    {
        var configured = config["Jwt:Key"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            if (Encoding.UTF8.GetByteCount(configured) < 32)
                throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");
            return configured;
        }
        var dir = Path.Combine(contentRoot, "App_Data");
        var file = Path.Combine(dir, "jwt.key");
        if (File.Exists(file)) return File.ReadAllText(file).Trim();
        Directory.CreateDirectory(dir);
        var key = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
        File.WriteAllText(file, key);
        return key;
    }
}
