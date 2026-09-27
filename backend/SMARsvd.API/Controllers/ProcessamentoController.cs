using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMARsvd.API.Middlewares;
using SMARsvd.API.Models;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;
using SMARsvd.Application.Services;
using SMARsvd.Infrastructure.Data;
using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace SMARsvd.API.Controllers;

public class EtapaProcessamentoRequest
{
    public Guid LayoutId { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public bool UsouOcr { get; set; }
    public ConfiguracaoBancoDto? ConexaoBanco { get; set; }
    public DateTime? InicioProcessamento { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class ProcessamentoController : ControllerBase
{
    private readonly ProcessadorCarnesService _processadorService;
    private readonly IAuditoriaValidacaoService _auditoriaService;
    private readonly IBancoDadosExecutorFactory _bancoFactory;
    private readonly IPastaTemporariaService _pastaTemporaria;
    private readonly SMARsvdDbContext _context;

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ProcessamentoController(
        ProcessadorCarnesService processadorService,
        IAuditoriaValidacaoService auditoriaService,
        IBancoDadosExecutorFactory bancoFactory,
        IPastaTemporariaService pastaTemporaria,
        SMARsvdDbContext context)
    {
        _processadorService = processadorService;
        _auditoriaService = auditoriaService;
        _bancoFactory = bancoFactory;
        _pastaTemporaria = pastaTemporaria;
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
                IdentificadorPosterior = c.IdentificadorPosterior,
                TipoDado = c.TipoDado,
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

    private string ObterPastaTemp() => _pastaTemporaria.ObterPastaUsuario(HttpContext.ObterUsuarioSessao());

    // Etapa 0 - Validação das credenciais antes de iniciar a extração
    [HttpPost("testar-conexao")]
    public async Task<IActionResult> TestarConexao([FromBody] ConfiguracaoBancoDto conexaoBanco)
    {
        // Primeira etapa do processo: o horário é devolvido ao front-end e reenviado na etapa final,
        // para que início e fim do processamento venham do mesmo relógio (o do servidor).
        var inicioProcessamento = DateTime.UtcNow;

        try
        {
            var executor = _bancoFactory.ObterExecutor(conexaoBanco.Provedor);
            await executor.TestarConexaoAsync(conexaoBanco);
            return Ok(new { status = "Conectado", inicioProcessamento });
        }
        catch (NotSupportedException ex)
        {
            return BadRequest(new { mensagem = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha ao conectar no banco de dados.", erro = ex.Message });
        }
    }

    // Etapa 1 - Extração
    // Lotes com milhares de páginas ultrapassam os limites padrão de upload (30 MB no Kestrel, 128 MB no multipart)
    [HttpPost("extrair")]
    [Consumes("multipart/form-data")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
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

            var resultadoExtracao = await _processadorService.ProcessarLoteAsync(caminhoPdf, layoutDto, request.Amostragem, pastaTemp);

            return Ok(new { Extracao = resultadoExtracao });
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha durante a extração do PDF.", erro = ex.Message });
        }
        finally
        {
            try
            {
                if (System.IO.File.Exists(caminhoPdf))
                {
                    System.IO.File.Delete(caminhoPdf);
                }
            }
            catch (IOException) { }
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
                pastaTemp,
                request.InicioProcessamento);

            return Ok(resultadoFinal);
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha ao validar regras do lote.", erro = ex.Message });
        }
    }
}