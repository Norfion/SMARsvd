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

    [HttpPost("processar")]
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

        // Salvar PDF temporariamente para processamento incremental
        string pastaTemp = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "database", "temp");
        Directory.CreateDirectory(pastaTemp);
        string caminhoPdf = Path.Combine(pastaTemp, request.ArquivoPdf.FileName);

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

        var resultado = await _processadorService.ProcessarLoteAsync(caminhoPdf, layoutDto, request.Amostragem);

        return Ok(resultado);
    }
}