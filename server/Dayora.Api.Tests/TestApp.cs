using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dayora.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Dayora.Api.Tests;

/// <summary>Starts the real API against a throw-away SQL Server LocalDB database.</summary>
public class TestApp : WebApplicationFactory<Program>
{
    private readonly string _dbName = $"DayoraTests_{Guid.NewGuid():N}";
    // LocalDB by default. To use another SQL Server: $env:DAYORA_TEST_SERVER = "."
    private static readonly string SqlServerName = Environment.GetEnvironmentVariable("DAYORA_TEST_SERVER") ?? "(localdb)\\MSSQLLocalDB";
    public string ConnectionString =>
        $"Server={SqlServerName};Database={_dbName};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        builder.UseSetting("Jwt:Key", "tests-only-key-tests-only-key-tests-only-key");
        builder.UseSetting("RateLimit:AuthPerWindow", "100000");
        builder.UseSetting("RateLimit:ContactPerWindow", "3");
        builder.UseSetting("Security:BcryptWorkFactor", "4"); // fast hashing, tests only
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(ConnectionString).Options);
            db.Database.EnsureDeleted();
        }
        base.Dispose(disposing);
    }

    private int _n;
    /// <summary>A new account (own email) and a client that is already logged in as it.</summary>
    public async Task<(HttpClient Client, string Email)> NewUserAsync(string password = "secret1")
    {
        var email = $"user{Interlocked.Increment(ref _n)}@test.com";
        var client = CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/register", new { name = "Test User", email, password });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("token").GetString());
        return (client, email);
    }
}

public static class Json
{
    public static async Task<JsonElement> Body(this HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();
}
