using Microsoft.AspNetCore.Mvc;
using SMARsvd.API.Middlewares;
using SMARsvd.Application.DTOs;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LogsController : ControllerBase
{
    private static readonly string[] TiposPermitidos = { "Erro", "Exceção", "Informação", "Aviso" };
    private const string PrefixoOrigemFrontend = "Front-end";

    private readonly ILogService _logService;

    public LogsController(ILogService logService)
    {
        _logService = logService;
    }

    [HttpPost]
    public async Task<IActionResult> RegistrarLog([FromBody] LogCriacaoDto request)
    {
        if (!TiposPermitidos.Contains(request.Tipo, StringComparer.Ordinal))
            request.Tipo = "Erro";

        // Logs enviados pelo navegador nunca podem se passar por registros do back-end ou de outro usuário
        string origem = request.Origem?.Trim() ?? string.Empty;
        if (!origem.StartsWith(PrefixoOrigemFrontend, StringComparison.OrdinalIgnoreCase))
            origem = string.IsNullOrEmpty(origem) ? PrefixoOrigemFrontend : $"{PrefixoOrigemFrontend} - {origem}";

        request.Origem = origem;
        request.Usuario = HttpContext.ObterUsuarioSessao();

        await _logService.RegistrarLogAsync(request);
        return Ok();
    }
}
