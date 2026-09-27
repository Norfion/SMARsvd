namespace SMARsvd.Application.Interfaces;

public record ResultadoAutenticacaoRede(bool Sucesso, string? Usuario, string? Mensagem)
{
    public static ResultadoAutenticacaoRede Autenticado(string usuario) => new(true, usuario, null);
    public static ResultadoAutenticacaoRede Falha(string mensagem) => new(false, null, mensagem);
}

public interface IAutenticacaoRedeService
{
    string Dominio { get; }

    // Aceita "usuario", "DOMINIO\usuario" ou "usuario@dominio"; o usuário devolvido é sempre o login normalizado
    ResultadoAutenticacaoRede Autenticar(string usuario, string senha);
}
