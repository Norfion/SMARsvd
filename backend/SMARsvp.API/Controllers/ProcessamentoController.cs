using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMARsvp.API.Models;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.DTOs.Processamento;
using SMARsvp.Application.Interfaces;
using SMARsvp.Application.Services;
using SMARsvp.Infrastructure.Data;
using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace SMARsvp.API.Controllers;

public class EtapaProcessamentoRequest
{
    public Guid LayoutId { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public bool UsouOcr { get; set; }
    public ConfiguracaoBancoDto? ConexaoBanco { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class ProcessamentoController : ControllerBase
{
    private readonly ProcessadorCarnesService _processadorService;
    private readonly IAuditoriaValidacaoService _auditoriaService;
    private readonly SMARsvpDbContext _context;

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ProcessamentoController(
        ProcessadorCarnesService processadorService,
        IAuditoriaValidacaoService auditoriaService,
        SMARsvpDbContext context)
    {
        _processadorService = processadorService;
        _auditoriaService = auditoriaService;
        _context = context;
    }

    private async Task<LayoutClienteDto?> ObterLayoutCompletoAsync(Guid layoutId)
    {
        var layout = await _context.Layouts
            .Include(l => l.Campos)
            .Include(l => l.QueriesValidacao).ThenInclude(q => q.Regras)
            .AsSplitQuery()
            .FirstOrDefaultAsync(l => l.Id == layoutId);

        if (layout == null) return null;

        return new LayoutClienteDto
        {
            Id = layout.Id,
            NomeModelo = layout.NomeModelo,
            Cliente = layout.Cliente,
            Campos = layout.Campos.Select(c => new RegiaoCampoDto
            {
                Id = c.Id,
                NomeCampo = c.NomeCampo,
                TipoClassificacao = c.TipoClassificacao,
                TextoEsperadoDocumento = c.TextoEsperadoDocumento,
                TextoEsperadoPagina = c.TextoEsperadoPagina,
                IdentificadorPagina = c.IdentificadorPagina,
                IdentificadorAnterior = c.IdentificadorAnterior,
                Pagina = c.Pagina,
                XMm = c.XMm,
                YMm = c.YMm,
                LarguraMm = c.LarguraMm,
                AlturaMm = c.AlturaMm,
                ConsultaSql = c.ConsultaSql
            }).ToList(),
            QueriesValidacao = layout.QueriesValidacao.Select(q => new QueryValidacaoDto
            {
                Id = q.Id,
                Nome = q.Nome,
                Sql = q.Sql,
                Regras = q.Regras.Select(r => new RegraValidacaoDto
                {
                    Id = r.Id,
                    CampoRetornado = r.CampoRetornado,
                    Operador = r.Operador,
                    CampoCarne = r.CampoCarne
                }).ToList()
            }).ToList()
        };
    }

    private string ObterPastaTemp()
    {
        string pastaTemp = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "database", "temp"));
        if (!Directory.Exists(Path.GetDirectoryName(pastaTemp)))
        {
            pastaTemp = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database", "temp");
        }
        Directory.CreateDirectory(pastaTemp);
        return pastaTemp;
    }

    // Etapa 1 - Extração
    [HttpPost("extrair")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ExtrairDadosPdf([FromForm] ProcessarPdfRequest request)
    {
        if (request.Amostragem < 0 || request.Amostragem > 100)
            return BadRequest("A amostragem deve estar entre 0 e 100.");

        if (request.ArquivoPdf == null || request.ArquivoPdf.Length == 0)
            return BadRequest("Arquivo PDF inválido.");

        var layoutDto = await ObterLayoutCompletoAsync(request.LayoutId);
        if (layoutDto == null)
            return NotFound("Layout não encontrado.");

        string pastaTemp = ObterPastaTemp();
        string extensaoOriginal = Path.GetExtension(request.ArquivoPdf.FileName);
        string caminhoPdf = Path.Combine(pastaTemp, $"arquivo_importado{extensaoOriginal}");

        try
        {
            using (var stream = new FileStream(caminhoPdf, FileMode.Create))
            {
                await request.ArquivoPdf.CopyToAsync(stream);
            }

            var resultadoExtracao = await _processadorService.ProcessarLoteAsync(caminhoPdf, layoutDto, request.Amostragem);

            return Ok(new { Extracao = resultadoExtracao });
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha durante a extração do PDF.", erro = ex.Message });
        }
        finally
        {
            if (System.IO.File.Exists(caminhoPdf))
            {
                System.IO.File.Delete(caminhoPdf);
            }
        }
    }

    // Etapa 2 - Montagem e Execução das Consultas (recebe as credenciais da tela)
    [HttpPost("buscar-banco")]
    public async Task<IActionResult> ConstruirQueriesEBuscar([FromBody] EtapaProcessamentoRequest request)
    {
        var layoutDto = await ObterLayoutCompletoAsync(request.LayoutId);
        if (layoutDto == null)
            return NotFound("Layout não encontrado.");

        string pastaTemp = ObterPastaTemp();
        string caminhoExtracao = Path.Combine(pastaTemp, "dados_extraidos.json");

        if (!System.IO.File.Exists(caminhoExtracao))
            return BadRequest("Arquivo de extração não encontrado. Execute a etapa de extração primeiro.");

        try
        {
            string resultadoJson = await System.IO.File.ReadAllTextAsync(caminhoExtracao);
            var extracao = JsonSerializer.Deserialize<ResultadoProcessamentoDto>(resultadoJson, OpcoesJson);

            if (extracao == null)
                return BadRequest("Não foi possível carregar os dados da extração anterior.");

            await _auditoriaService.MontarQueriesEBuscarBancoAsync(extracao, layoutDto, pastaTemp, request.ConexaoBanco);
            return Ok(new { status = "Concluído" });
        }
        catch (NotSupportedException ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha ao conectar ou executar consultas no banco de dados.", erro = ex.Message });
        }
    }

    // Etapa 3 - Validação e Comparação Final
    [HttpPost("validar-regras")]
    public async Task<IActionResult> ValidarRegrasLote([FromBody] EtapaProcessamentoRequest request)
    {
        var layoutDto = await ObterLayoutCompletoAsync(request.LayoutId);
        if (layoutDto == null)
            return NotFound("Layout não encontrado.");

        string pastaTemp = ObterPastaTemp();
        string caminhoExtracao = Path.Combine(pastaTemp, "dados_extraidos.json");

        if (!System.IO.File.Exists(caminhoExtracao))
            return BadRequest("Arquivo de extração não encontrado. Execute a etapa de extração primeiro.");

        try
        {
            string resultadoJson = await System.IO.File.ReadAllTextAsync(caminhoExtracao);
            var extracao = JsonSerializer.Deserialize<ResultadoProcessamentoDto>(resultadoJson, OpcoesJson);

            if (extracao == null)
                return BadRequest("Não foi possível carregar os dados da extração anterior.");

            var resultadoFinal = await _auditoriaService.CompararEGerarAuditoriaAsync(
                extracao,
                layoutDto,
                request.NomeArquivo,
                request.UsouOcr,
                pastaTemp);

            return Ok(resultadoFinal);
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha ao validar regras do lote.", erro = ex.Message });
        }
    }
}