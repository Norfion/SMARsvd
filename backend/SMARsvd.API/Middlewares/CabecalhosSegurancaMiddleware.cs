namespace SMARsvd.API.Middlewares;

public class CabecalhosSegurancaMiddleware
{
    // 'wasm-unsafe-eval' é exigido pelos decodificadores de imagem em WebAssembly do PDF.js;
    // 'unsafe-inline' em estilos é exigido pelo AG Grid e pelo posicionamento das regiões no editor de layout
    private const string PoliticaConteudo =
        "default-src 'self'; " +
        "script-src 'self' 'wasm-unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' data: blob:; " +
        "worker-src 'self' blob:; " +
        "frame-src 'self' blob:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'";

    private readonly RequestDelegate _next;

    public CabecalhosSegurancaMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var cabecalhos = context.Response.Headers;
            cabecalhos["X-Content-Type-Options"] = "nosniff";
            cabecalhos["X-Frame-Options"] = "DENY";
            cabecalhos["Referrer-Policy"] = "no-referrer";
            cabecalhos["Cross-Origin-Opener-Policy"] = "same-origin";
            cabecalhos["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

            // A interface de documentação (apenas em desenvolvimento) usa scripts embutidos
            if (!context.Request.Path.StartsWithSegments("/swagger"))
                cabecalhos["Content-Security-Policy"] = PoliticaConteudo;

            // As respostas da API trazem dados de contribuintes e não devem ficar no cache do navegador
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                cabecalhos["Cache-Control"] = "no-store";
                cabecalhos["Pragma"] = "no-cache";
            }

            return Task.CompletedTask;
        });

        return _next(context);
    }
}
