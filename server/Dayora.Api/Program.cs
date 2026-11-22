using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Dayora.Api.Data;
using Dayora.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database (SQL Server) ----------
var connection = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is missing.");
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(connection));

// ---------- Login tokens (JWT) ----------
var jwt = new JwtOptions
{
    Key = JwtKey.Resolve(builder.Configuration, builder.Environment.ContentRootPath),
    Issuer = builder.Configuration["Jwt:Issuer"] ?? "dayora",
    ExpiresDays = builder.Configuration.GetValue("Jwt:ExpiresDays", 7),
};
builder.Services.Configure<JwtOptions>(o => { o.Key = jwt.Key; o.Issuer = jwt.Issuer; o.ExpiresDays = jwt.ExpiresDays; });
builder.Services.AddSingleton<TokenService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // keep claim names exactly as we wrote them
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidIssuer = jwt.Issuer,
            ValidateAudience = true, ValidAudience = jwt.Issuer,
            ValidateLifetime = true, ClockSkew = TimeSpan.FromMinutes(1),
            ValidateIssuerSigningKey = true, IssuerSigningKey = TokenService.SigningKey(jwt.Key),
            NameClaimType = ClaimTypes.NameIdentifier,
        };
        o.Events = new JwtBearerEvents
        {
            // A token for an account that was deleted must stop working at once.
            OnTokenValidated = async ctx =>
            {
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var id = ctx.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(id, out var userId) || !await db.Users.AnyAsync(u => u.Id == userId))
                    ctx.Fail("user no longer exists");
            },
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                await ErrorMiddleware.Write(ctx.HttpContext, 401, "Please log in first", null);
            },
        };
    });
builder.Services.AddAuthorization();

// ---------- Controllers + JSON ----------
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    })
    .UseDayoraValidationErrors();

// ---------- Browser access when the pages are opened from VS Code Live Server ----------
var origins = new[] { "http://localhost:5501", "http://127.0.0.1:5501" }
    .Concat((builder.Configuration["Cors:Origins"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    .ToArray();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

// ---------- Rate limits (brute-force and spam protection) ----------
var authLimit = builder.Configuration.GetValue("RateLimit:AuthPerWindow", 30);
var contactLimit = builder.Configuration.GetValue("RateLimit:ContactPerWindow", 5);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (ctx, _) =>
        await ErrorMiddleware.Write(ctx.HttpContext, 429, "Too many attempts, please wait a few minutes and try again", null);
    RateLimitPartition<string> Window(HttpContext c, int permits) =>
        RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = TimeSpan.FromMinutes(15) });
    o.AddPolicy("auth", c => Window(c, authLimit));
    o.AddPolicy("contact", c => Window(c, contactLimit));
});

var app = builder.Build();

// Create/upgrade the database on start-up so a fresh clone just works.
if (builder.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

app.UseMiddleware<ErrorMiddleware>();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// Unknown /api/... paths answer with JSON, not with an HTML page.
app.Map("/api/{**rest}", (HttpContext c) => ErrorMiddleware.Write(c, 404, "Unknown API endpoint", null));

// ---------- Serve the website (pages, css, js, imgs) ----------
// The home page is pages/home.html. Only these folders are public:
// the server code, the database and .git are never served.
app.MapGet("/", () => Results.Redirect("/pages/home.html"));

var siteRoot = FindSiteRoot(builder.Environment.ContentRootPath);
if (siteRoot is not null)
{
    var site = new PhysicalFileProvider(siteRoot);
    var publicFolders = new[] { "/css", "/js", "/pages", "/imgs" };
    app.UseWhen(
        c => publicFolders.Any(f => c.Request.Path.StartsWithSegments(f)),
        branch => branch.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = site,
            // "no-cache" = the browser asks the server whether the file changed (cheap, uses ETag)
            // instead of silently showing an old copy of the CSS/JS after you edit it.
            OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
        }));
}

app.Run();

static string? FindSiteRoot(string start)
{
    for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
        if (File.Exists(Path.Combine(dir.FullName, "pages", "home.html")) && Directory.Exists(Path.Combine(dir.FullName, "css")))
            return dir.FullName;
    return null;
}

public partial class Program;
