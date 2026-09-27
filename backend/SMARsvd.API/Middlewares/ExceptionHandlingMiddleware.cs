using System.Text.Json;
using SMARsvd.Application.DTOs;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Middlewares;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;

    public ExceptionHandlingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context); // Tenta processar a requisição normalmente
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex); // Se explodir, cai aqui
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        // Cria um novo escopo de serviço. Isso garante que conseguimos gravar o log 
        // mesmo se a transação do banco na requisição original tiver falhado.
        using var scope = context.RequestServices.CreateScope();
        var logService = scope.ServiceProvider.GetRequiredService<ILogService>();

        var detalhes = JsonSerializer.Serialize(new
        {
<<<<<<< HEAD
            Usuario = context.ObterUsuarioSessaoOuNulo(),
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
            Endpoint = context.Request.Path.Value,
            Metodo = context.Request.Method,
            QueryString = context.Request.QueryString.Value
        });

        // Tenta gravar a exceção no banco
        try
        {
            await logService.RegistrarLogAsync(new LogCriacaoDto
            {
                Tipo = "Exceção",
                Mensagem = exception.Message,
                Origem = "Back-end (Middleware Global)",
                StackTrace = exception.StackTrace,
                Detalhes = detalhes
            });
        }
        catch { /* Falha silenciosa caso o próprio banco esteja offline */ }

        // Retorna uma mensagem amigável e padronizada para o Front-end
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var result = JsonSerializer.Serialize(new
        {
            erro = "Ocorreu um erro interno no servidor.",
            detalhe = exception.Message
        });

        await context.Response.WriteAsync(result);
    }
}