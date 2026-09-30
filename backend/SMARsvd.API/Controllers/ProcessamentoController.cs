using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMARsvd.API.Filters;
using SMARsvd.API.Middlewares;
using SMARsvd.API.Models;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;
using SMARsvd.Application.Services;
using SMARsvd.Infrastructure.Data;
using System.Text.Json;

namespace SMARsvd.API.Controllers;

public class EtapaProcessamentoRequest
{
    public Guid LayoutId { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public bool UsouOcr { get; set; }
    public ConfiguracaoBancoDto? ConexaoBanco { get; set; }
    public DateTime? InicioProcessamento { get; set; }
}

public class EntrarFilaRequest
{
    public bool AguardarNaFila { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class ProcessamentoController : ControllerBase
{
    private readonly ProcessadorCarnesService _processadorService;
    private readonly IAuditoriaValidacaoService _auditoriaService;
    private readonly IBancoDadosExecutorFactory _bancoFactory;
    private readonly IPastaTemporariaService _pastaTemporaria;
    private readonly IFilaProcessamentoService _fila;
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
        IFilaProcessamentoService fila,
        SMARsvdDbContext context)
    {
        _processadorService = processadorService;
        _auditoriaService = auditoriaService;
        _bancoFactory = bancoFactory;
        _pastaTemporaria = pastaTemporaria;
        _fila = fila;
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

    // Apenas um usuário processa por vez. Com aguardarNaFila = false, quem encontrar outra pessoa processando
    // apenas é informado; o front-end chama novamente com true (e repete a chamada) para aguardar a vez.
    [HttpPost("fila/entrar")]
    public IActionResult EntrarNaFila([FromBody] EntrarFilaRequest request)
    {
        var situacao = _fila.Entrar(HttpContext.ObterUsuarioSessao(), request.AguardarNaFila);

        if (situacao.Situacao == SituacaoFila.ProcessamentoEmAndamento)
        {
            return Conflict(new
            {
                mensagem = "Você já possui uma validação em andamento. Aguarde a conclusão antes de iniciar outra."
            });
        }

        return Ok(new
        {
            liberado = situacao.Situacao == SituacaoFila.Liberado,
            naFila = situacao.Situacao == SituacaoFila.NaFila,
            posicao = situacao.Posicao
        });
    }

    [HttpPost("fila/sair")]
    public IActionResult SairDaFila()
    {
        _fila.Sair(HttpContext.ObterUsuarioSessao());
        return NoContent();
    }

    // Etapa 0 - Validação das credenciais antes de iniciar a extração
    [HttpPost("testar-conexao")]
    [ExigeVezNaFila]
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

    // Lotes com milhares de páginas ultrapassam os limites padrão de upload (30 MB no Kestrel, 128 MB no multipart),
    // mas um teto continua necessário para que uma única requisição não esgote o disco do servidor
    private const long TamanhoMaximoPdfBytes = 4L * 1024 * 1024 * 1024;

    private static readonly byte[] AssinaturaPdf = System.Text.Encoding.ASCII.GetBytes("%PDF-");

    // A especificação permite que o cabeçalho %PDF- apareça em qualquer ponto do primeiro 1 KB do arquivo
    private static async Task<bool> PossuiAssinaturaPdfAsync(IFormFile arquivo)
    {
        var inicio = new byte[1024];
        await using var stream = arquivo.OpenReadStream();

        int lidos = 0;
        while (lidos < inicio.Length)
        {
            int n = await stream.ReadAsync(inicio.AsMemory(lidos, inicio.Length - lidos));
            if (n == 0) break;
            lidos += n;
        }

        return inicio.AsSpan(0, lidos).IndexOf(AssinaturaPdf) >= 0;
    }

    // Etapa 1 - Extração
    [HttpPost("extrair")]
    [ExigeVezNaFila]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(TamanhoMaximoPdfBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = TamanhoMaximoPdfBytes)]
    public async Task<IActionResult> ExtrairDadosPdf([FromForm] ProcessarPdfRequest request)
    {
        if (request.Amostragem < 0 || request.Amostragem > 100)
            return BadRequest("A amostragem deve estar entre 0 e 100.");

        if (request.ArquivoPdf == null || request.ArquivoPdf.Length == 0)
            return BadRequest("Arquivo PDF inválido.");

        if (!await PossuiAssinaturaPdfAsync(request.ArquivoPdf))
            return BadRequest("O arquivo enviado não é um documento PDF válido.");

        var layoutDto = await ObterLayoutCompletoAsync(request.LayoutId);
        if (layoutDto == null)
            return NotFound("Layout não encontrado.");

        string pastaTemp = ObterPastaTemp();
        // O nome enviado pelo navegador não é usado no caminho, evitando extensões ou fluxos alternativos arbitrários
        string caminhoPdf = Path.Combine(pastaTemp, "arquivo_importado.pdf");

        try
        {
            using (var stream = new FileStream(caminhoPdf, FileMode.Create, FileAccess.Write, FileShare.None))
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
    [ExigeVezNaFila]
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
    [ExigeVezNaFila]
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
                HttpContext.ObterUsuarioSessao(),
                request.InicioProcessamento);

            return Ok(resultadoFinal);
        }
        catch (Exception ex)
        {
            return StatusCode(422, new { mensagem = "Falha ao validar regras do lote.", erro = ex.Message });
        }
    }
}