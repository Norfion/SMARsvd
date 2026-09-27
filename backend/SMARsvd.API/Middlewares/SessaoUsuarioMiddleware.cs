using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Middlewares;

public class SessaoUsuarioMiddleware
{
    public const string CabecalhoToken = "X-Sessao-Token";

    private static readonly PathString[] RotasPublicas =
    {
        "/api/autenticacao/login",
        "/api/autenticacao/encerrar"
    };

    private readonly RequestDelegate _next;

    public SessaoUsuarioMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ISessaoUsuarioService sessoes)
    {
        var caminho = context.Request.Path;
        if (!caminho.StartsWithSegments("/api") || RotasPublicas.Any(r => caminho.Equals(r, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(context);
            return;
        }

        string token = context.Request.Headers[CabecalhoToken].ToString();
        string? usuario = string.IsNullOrWhiteSpace(token) ? null : sessoes.IniciarRequisicao(token);

        if (usuario == null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { mensagem = "Sessão inválida ou expirada. Faça login novamente." });
            return;
        }

        context.DefinirUsuarioSessao(usuario);

        try
        {
            await _next(context);
        }
        finally
        {
            sessoes.FinalizarRequisicao(token);
        }
    }
}

public static class HttpContextSessaoExtensions
{
    private const string ChaveUsuario = "SMARsvd.UsuarioSessao";

    public static void DefinirUsuarioSessao(this HttpContext context, string usuario) =>
        context.Items[ChaveUsuario] = usuario;

    public static string? ObterUsuarioSessaoOuNulo(this HttpContext context) =>
        context.Items[ChaveUsuario] as string;

    public static string ObterUsuarioSessao(this HttpContext context) =>
        context.ObterUsuarioSessaoOuNulo()
        ?? throw new InvalidOperationException("A requisição não possui uma sessão de usuário autenticada.");
}
