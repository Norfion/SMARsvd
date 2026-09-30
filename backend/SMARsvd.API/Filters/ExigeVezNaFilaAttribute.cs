using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SMARsvd.API.Middlewares;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Filters;

// Etapas do processamento só executam para quem está com a vez na fila; a execução mantém a vez reservada.
// É um filtro de recurso para recusar a requisição antes da leitura do corpo (o upload do PDF, por exemplo).
[AttributeUsage(AttributeTargets.Method)]
public sealed class ExigeVezNaFilaAttribute : Attribute, IAsyncResourceFilter
{
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var fila = context.HttpContext.RequestServices.GetRequiredService<IFilaProcessamentoService>();
        string usuario = context.HttpContext.ObterUsuarioSessao();

        if (!fila.IniciarEtapa(usuario))
        {
            context.Result = new ConflictObjectResult(new
            {
                mensagem = "Sua vez na fila de validação expirou ou ainda não chegou. Clique em Validar para tentar novamente."
            });
            return;
        }

        try
        {
            await next();
        }
        finally
        {
            fila.FinalizarEtapa(usuario);
        }
    }
}
