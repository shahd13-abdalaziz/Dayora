using Google.Apis.Auth;

namespace Dayora.Api.Infrastructure;

/// <summary>What Google tells us about the person who signed in.</summary>
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? Name);

/// <summary>
/// Checks a Google sign-in token. It is an interface so the tests can use a fake one
/// (a real token can only come from a real Google sign-in in a browser).
/// </summary>
public interface IGoogleTokenValidator
{
    /// <returns>The person, or null when the token is fake, expired, or made for another app.</returns>
    Task<GoogleIdentity?> ValidateAsync(string credential, string clientId);
}

public class GoogleTokenValidator : IGoogleTokenValidator
{
    public async Task<GoogleIdentity?> ValidateAsync(string credential, string clientId)
    {
        try
        {
            // Google's library checks the signature (with Google's public keys), the expiry,
            // that it was issued by Google, and that it was made for OUR client id.
            var payload = await GoogleJsonWebSignature.ValidateAsync(credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
            return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.Name);
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }
}
