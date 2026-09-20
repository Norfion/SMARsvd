using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMARsvp.API.Models;
using SMARsvp.Application.Services;
using SMARsvp.Infrastructure.Data;

namespace SMARsvp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProcessamentoController : ControllerBase
{
    private readonly ProcessadorCarnesService _processadorService;
    private readonly SMARsvpDbContext _context;

    public ProcessamentoController(ProcessadorCarnesService processadorService, SMARsvpDbContext context)
    {
        _processadorService = processadorService;
        _context = context;
    }

    [HttpPost("lote")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ProcessarPdf([FromForm] ProcessarPdfRequest request)
    {
        if (request.Amostragem < 0 || request.Amostragem > 100)
            return BadRequest("A amostragem deve estar entre 0 e 100.");

        if (request.ArquivoPdf == null || request.ArquivoPdf.Length == 0)
            return BadRequest("Arquivo PDF inválido.");

        var layout = await _context.Layouts
            .Include(l => l.Campos)
            .FirstOrDefaultAsync(l => l.Id == request.LayoutId);

        if (layout == null)
            return NotFound("Layout não encontrado no banco de dados.");

        // 1. Resolução segura da pasta database/temp
        string pastaTemp = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "database", "temp"));
        if (!Directory.Exists(Path.GetDirectoryName(pastaTemp)))
        {
            pastaTemp = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database", "temp");
        }

        Directory.CreateDirectory(pastaTemp);

        // 2. Extrai a extensão original (ex: .pdf) e define o nome fixo "arquivo_importado"
        string extensaoOriginal = Path.GetExtension(request.ArquivoPdf.FileName);
        string caminhoPdf = Path.Combine(pastaTemp, $"arquivo_importado{extensaoOriginal}");

        try
        {
            // Salva o arquivo no disco com o nome padronizado
            using (var stream = new FileStream(caminhoPdf, FileMode.Create))
            {
                await request.ArquivoPdf.CopyToAsync(stream);
            }

            var layoutDto = new SMARsvp.Application.DTOs.Layout.LayoutClienteDto
            {
                Id = layout.Id,
                Campos = layout.Campos.Select(c => new SMARsvp.Application.DTOs.Layout.RegiaoCampoDto
                {
                    NomeCampo = c.NomeCampo,
                    EhIdentificadorPrimeiraPagina = c.EhIdentificadorPrimeiraPagina,
                    TextoEsperadoIdentificador = c.TextoEsperadoIdentificador,
                    Pagina = c.Pagina,
                    XMm = c.XMm,
                    YMm = c.YMm,
                    LarguraMm = c.LarguraMm,
                    AlturaMm = c.AlturaMm
                }).ToList()
            };

            // Processa o PDF, identifica a estrutura e gera os arquivos JSON
            var resultado = await _processadorService.ProcessarLoteAsync(caminhoPdf, layoutDto, request.Amostragem);

            return Ok(resultado);
        }
        finally
        {
            // 3. Limpeza: apaga o arquivo temporário após o término do processamento
            if (System.IO.File.Exists(caminhoPdf))
            {
                try
                {
                    System.IO.File.Delete(caminhoPdf);
                    Console.WriteLine($"[ProcessamentoController] Arquivo temporário removido: {caminhoPdf}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ProcessamentoController] Não foi possível remover o arquivo temporário: {ex.Message}");
                }
            }
        }
    }
}