using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dayora.Api.Infrastructure;
using Xunit;

namespace Dayora.Api.Tests;

/// <summary>
/// Stands in for Google. A "credential" is written as   subject|email|verified|name   and is "valid";
/// anything else (for example "garbage") is a token Google would refuse.
/// </summary>
public class FakeGoogleValidator : IGoogleTokenValidator
{
    public Task<GoogleIdentity?> ValidateAsync(string credential, string clientId)
    {
        var p = credential.Split('|');
        if (p.Length != 4 || clientId != "test-client-id.apps.googleusercontent.com") return Task.FromResult<GoogleIdentity?>(null);
        return Task.FromResult<GoogleIdentity?>(new GoogleIdentity(p[0], p[1], p[2] == "true", p[3] == "" ? null : p[3]));
    }
}

/// <summary>A server where nobody filled in Google:ClientId.</summary>
public class AppWithoutGoogle : TestApp
{
    protected override string GoogleClientId => "";
}

public class GoogleTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public GoogleTests(TestApp app) => _app = app;

    private static Task<HttpResponseMessage> Google(HttpClient c, string credential) =>
        c.PostAsJsonAsync("/api/auth/google", new { credential });

    [Fact]
    public async Task Login_page_learns_the_client_id_from_the_server()
    {
        var cfg = await (await _app.CreateClient().GetAsync("/api/auth/config")).Body();
        Assert.Equal("test-client-id.apps.googleusercontent.com", cfg.GetProperty("googleClientId").GetString());
    }

    [Fact]
    public async Task First_google_sign_in_creates_the_account_and_a_working_token()
    {
        var c = _app.CreateClient();
        var res = await Google(c, "sub-new-1|NewPerson@Example.com|true|New Person");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Body();
        Assert.Equal("New Person", body.GetProperty("user").GetProperty("name").GetString());
        Assert.Equal("newperson@example.com", body.GetProperty("user").GetProperty("email").GetString());   // lower-cased

        // the token works like any other login token
        c.DefaultRequestHeaders.Authorization = new("Bearer", body.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/tasks")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/settings")).StatusCode);          // the account got its settings
    }

    [Fact]
    public async Task Signing_in_again_gives_the_same_account_not_a_second_one()
    {
        var c = _app.CreateClient();
        var first = (await (await Google(c, "sub-again|again@example.com|true|Again")).Body()).GetProperty("user").GetProperty("id").GetInt32();
        var second = (await (await Google(c, "sub-again|again@example.com|true|Again")).Body()).GetProperty("user").GetProperty("id").GetInt32();
        Assert.Equal(first, second);
    }

    [Fact]
    public async Task Same_person_after_changing_their_google_email_is_still_the_same_account()
    {
        var c = _app.CreateClient();
        var first = (await (await Google(c, "sub-moved|old@example.com|true|Mover")).Body()).GetProperty("user").GetProperty("id").GetInt32();
        var second = (await (await Google(c, "sub-moved|new@example.com|true|Mover")).Body()).GetProperty("user").GetProperty("id").GetInt32();
        Assert.Equal(first, second);       // found by Google's id, not by e-mail
    }

    [Fact]
    public async Task Google_sign_in_with_the_email_of_a_password_account_links_to_it()
    {
        var (_, email) = await _app.NewUserAsync();                // an account created with a password
        var c = _app.CreateClient();
        var viaGoogle = await (await Google(c, $"sub-link|{email}|true|Linked")).Body();

        // it is the same person's account: the password still works too, and there is only one account
        var viaPassword = await (await c.PostAsJsonAsync("/api/auth/login", new { email, password = "secret1" })).Body();
        Assert.Equal(viaPassword.GetProperty("user").GetProperty("id").GetInt32(), viaGoogle.GetProperty("user").GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task An_unverified_google_email_is_refused()
    {
        var res = await Google(_app.CreateClient(), "sub-unverified|someone@example.com|false|Someone");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        // ...and it did not create an account behind our back
        var login = await _app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = "someone@example.com", password = "secret1" });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task A_token_google_would_refuse_is_refused()
    {
        var res = await Google(_app.CreateClient(), "garbage");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task A_missing_credential_is_a_validation_error()
    {
        var res = await _app.CreateClient().PostAsJsonAsync("/api/auth/google", new { });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task A_google_only_account_cannot_log_in_with_a_password()
    {
        var c = _app.CreateClient();
        await Google(c, "sub-nopass|nopass@example.com|true|No Pass");
        // "dayora-dummy-password" is the secret behind the fake hash used for unknown e-mails: it must not open a Google account
        foreach (var guess in new[] { "secret1", "nopass@example.com", "null", "dayora-dummy-password" })
        {
            var res = await c.PostAsJsonAsync("/api/auth/login", new { email = "nopass@example.com", password = guess });
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }
    }

    [Fact]
    public async Task A_google_only_account_has_no_password_to_change_and_deletes_by_typing_its_email()
    {
        var c = _app.CreateClient();
        var body = await (await Google(c, "sub-del|del@example.com|true|Del Me")).Body();
        c.DefaultRequestHeaders.Authorization = new("Bearer", body.GetProperty("token").GetString());

        var change = await c.PutAsJsonAsync("/api/auth/password", new { currentPassword = "x", newPassword = "newsecret" });
        Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);

        HttpRequestMessage Delete(object payload) => new(HttpMethod.Delete, "/api/auth/me") { Content = JsonContent.Create(payload) };
        Assert.Equal(HttpStatusCode.Forbidden, (await c.SendAsync(Delete(new { confirmEmail = "wrong@example.com" }))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.SendAsync(Delete(new { password = "anything" }))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.SendAsync(Delete(new { confirmEmail = "DEL@example.com" }))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/tasks")).StatusCode);
    }

    [Fact]
    public async Task A_password_account_still_deletes_with_its_password_only()
    {
        var (c, email) = await _app.NewUserAsync();
        HttpRequestMessage Delete(object payload) => new(HttpMethod.Delete, "/api/auth/me") { Content = JsonContent.Create(payload) };
        // typing the e-mail is NOT enough for an account that has a password
        Assert.Equal(HttpStatusCode.Forbidden, (await c.SendAsync(Delete(new { confirmEmail = email }))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.SendAsync(Delete(new { password = "secret1" }))).StatusCode);
    }

    [Fact]
    public async Task Without_a_client_id_google_sign_in_is_off()
    {
        using var off = new AppWithoutGoogle();
        var client = off.CreateClient();
        var cfg = await (await client.GetAsync("/api/auth/config")).Body();
        Assert.Equal(JsonValueKind.Null, cfg.GetProperty("googleClientId").ValueKind);   // the login page hides the button
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await Google(client, "sub|a@b.com|true|A B")).StatusCode);
    }
}
