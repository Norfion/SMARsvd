using System.ComponentModel.DataAnnotations;

namespace SMARsvd.API.Models;

public class LoginRequest
{
    [MaxLength(256)]
    public string Usuario { get; set; } = string.Empty;

    [MaxLength(512)]
    public string Senha { get; set; } = string.Empty;
}

public class EncerrarSessaoRequest
{
    [MaxLength(128)]
    public string Token { get; set; } = string.Empty;
}
