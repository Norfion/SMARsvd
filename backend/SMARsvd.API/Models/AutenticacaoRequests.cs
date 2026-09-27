namespace SMARsvd.API.Models;

public class LoginRequest
{
    public string Usuario { get; set; } = string.Empty;
    public string Senha { get; set; } = string.Empty;
}

public class EncerrarSessaoRequest
{
    public string Token { get; set; } = string.Empty;
}
