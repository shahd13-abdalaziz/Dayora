using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dayora.Api.Data;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Dayora.Api.Infrastructure;

public class TokenService(IOptions<JwtOptions> options)
{
    public static SymmetricSecurityKey SigningKey(string key) => new(Encoding.UTF8.GetBytes(key));

    public string Create(User user)
    {
        var o = options.Value;
        var token = new JwtSecurityToken(
            issuer: o.Issuer,
            audience: o.Issuer,
            claims: [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())],
            expires: DateTime.UtcNow.AddDays(o.ExpiresDays),
            signingCredentials: new SigningCredentials(SigningKey(o.Key), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
