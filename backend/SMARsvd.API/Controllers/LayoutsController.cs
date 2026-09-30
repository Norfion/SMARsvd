using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMARsvd.API.Services;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.Interfaces;
using SMARsvd.Domain.Entities;
using SMARsvd.Infrastructure.Data;

namespace SMARsvd.API.Controllers;

public class ExcluirLayoutRequest
{
    public string? SenhaExclusao { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class LayoutsController : ControllerBase
{
    private const int MaximoPaginasModelo = 10;
    private static readonly string[] PrefixosImagemPermitidos = { "data:image/png;base64,", "data:image/jpeg;base64," };

    private readonly SMARsvdDbContext _context;
    private readonly IValidadorConsultaSql _validadorSql;
    private readonly SenhaExclusaoLayoutService _senhaExclusao;

    public LayoutsController(SMARsvdDbContext context, IValidadorConsultaSql validadorSql, SenhaExclusaoLayoutService senhaExclusao)
    {
        _context = context;
        _validadorSql = validadorSql;
        _senhaExclusao = senhaExclusao;
    }

    [HttpPost("validar-sql")]
    public ActionResult<ResultadoValidacaoSqlDto> ValidarSql([FromBody] ValidarSqlRequest request)
    {
        return Ok(_validadorSql.Validar(request.Sql));
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LayoutClienteDto>>> ListarTodos()
    {
        var layouts = await _context.Layouts
            .Include(l => l.Campos)
            .Include(l => l.QueriesValidacao)
                .ThenInclude(q => q.Regras)
            .Include(l => l.PaginasModelo)
            .AsSplitQuery()
            .AsNoTracking()
            .ToListAsync();

        var resultado = layouts.Select(l => new LayoutClienteDto
        {
            Id = l.Id,
            Cliente = l.Cliente,
            NomeModelo = l.NomeModelo,
            Versao = l.Versao,
            LarguraPaginaMm = l.LarguraPaginaMm,
            AlturaPaginaMm = l.AlturaPaginaMm,
            NomeArquivoModelo = l.NomeArquivoModelo,
            Campos = l.Campos.Select(c => new RegiaoCampoDto
            {
                Id = c.Id,
                NomeCampo = c.NomeCampo,
                XMm = c.XMm,
                YMm = c.YMm,
                LarguraMm = c.LarguraMm,
                AlturaMm = c.AlturaMm,
                Pagina = c.Pagina,
                TipoClassificacao = c.TipoClassificacao,
                TextoEsperadoDocumento = c.TextoEsperadoDocumento,
                TextoEsperadoPagina = c.TextoEsperadoPagina,
                IdentificadorPagina = c.IdentificadorPagina,
                IdentificadorAnterior = c.IdentificadorAnterior,
                IdentificadorPosterior = c.IdentificadorPosterior,
                TipoDado = c.TipoDado,
                ConsultaSql = c.ConsultaSql
            }).ToList(),
            QueriesValidacao = l.QueriesValidacao.Select(q => new QueryValidacaoDto
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
            }).ToList(),
            PaginasModeloBase64 = l.PaginasModelo
                .OrderBy(p => p.NumeroPagina)
                .Select(p => p.ImagemBase64)
                .ToList()
        }).ToList();

        return Ok(resultado);
    }

    [HttpPost]
    public async Task<ActionResult<Guid>> SalvarLayout([FromBody] LayoutClienteDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        foreach (var query in dto.QueriesValidacao ?? new List<QueryValidacaoDto>())
        {
            var validacao = _validadorSql.Validar(query.Sql);
            if (!validacao.Valida)
            {
                return BadRequest(new
                {
                    mensagem = $"A query \"{query.Nome}\" é inválida.",
                    erros = validacao.Erros
                });
            }
        }

        // As páginas do modelo são exibidas como <img> para todos os usuários: só imagens embutidas são aceitas,
        // nunca endereços externos
        var paginasModelo = dto.PaginasModeloBase64 ?? new List<string>();
        if (paginasModelo.Count > MaximoPaginasModelo)
            return BadRequest(new { mensagem = $"O modelo de referência aceita no máximo {MaximoPaginasModelo} páginas." });

        if (paginasModelo.Any(img => !ImagemEmbutidaValida(img)))
            return BadRequest(new { mensagem = "As páginas do modelo de referência devem ser imagens PNG ou JPEG." });

        await using var transacao = await _context.Database.BeginTransactionAsync();

        LayoutCliente? entidadeLayout = null;

        if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
        {
            entidadeLayout = await _context.Layouts
                .FirstOrDefaultAsync(l => l.Id == dto.Id.Value);
        }

        if (entidadeLayout == null && !string.IsNullOrWhiteSpace(dto.NomeModelo) && !string.IsNullOrWhiteSpace(dto.Cliente))
        {
            var nomeBusca = dto.NomeModelo.Trim().ToLower();
            var clienteBusca = dto.Cliente.Trim().ToLower();

            entidadeLayout = await _context.Layouts
                .FirstOrDefaultAsync(l => l.NomeModelo.ToLower() == nomeBusca && l.Cliente.ToLower() == clienteBusca);
        }

        if (entidadeLayout == null)
        {
            entidadeLayout = new LayoutCliente
            {
                Id = dto.Id.HasValue && dto.Id.Value != Guid.Empty ? dto.Id.Value : Guid.NewGuid()
            };
            _context.Layouts.Add(entidadeLayout);
        }
        else
        {
            var layoutId = entidadeLayout.Id;

            var queriesAntigasIds = await _context.QueriesValidacao
                .Where(q => q.LayoutClienteId == layoutId)
                .Select(q => q.Id)
                .ToListAsync();

            if (queriesAntigasIds.Any())
            {
                var regrasAntigas = _context.RegrasValidacao.Where(r => queriesAntigasIds.Contains(r.QueryValidacaoId));
                _context.RegrasValidacao.RemoveRange(regrasAntigas);
            }

            var camposAntigos = _context.RegioesCampos.Where(c => c.LayoutClienteId == layoutId);
            _context.RegioesCampos.RemoveRange(camposAntigos);

            var queriesAntigas = _context.QueriesValidacao.Where(q => q.LayoutClienteId == layoutId);
            _context.QueriesValidacao.RemoveRange(queriesAntigas);

            var paginasAntigas = _context.PaginasModelo.Where(p => p.LayoutClienteId == layoutId);
            _context.PaginasModelo.RemoveRange(paginasAntigas);

            await _context.SaveChangesAsync();
        }

        entidadeLayout.Cliente = dto.Cliente;
        entidadeLayout.NomeModelo = dto.NomeModelo;
        entidadeLayout.Versao = dto.Versao;
        entidadeLayout.LarguraPaginaMm = dto.LarguraPaginaMm;
        entidadeLayout.AlturaPaginaMm = dto.AlturaPaginaMm;
        entidadeLayout.NomeArquivoModelo = dto.NomeArquivoModelo;

        if (dto.Campos != null && dto.Campos.Any())
        {
            var novosCampos = dto.Campos.Select(c => new RegiaoCampo
            {
                Id = Guid.NewGuid(),
                NomeCampo = c.NomeCampo,
                XMm = c.XMm,
                YMm = c.YMm,
                LarguraMm = c.LarguraMm,
                AlturaMm = c.AlturaMm,
                Pagina = c.Pagina,
                TipoClassificacao = c.TipoClassificacao,
                TextoEsperadoDocumento = c.TextoEsperadoDocumento,
                TextoEsperadoPagina = c.TextoEsperadoPagina,
                IdentificadorPagina = c.IdentificadorPagina,
                IdentificadorAnterior = c.IdentificadorAnterior,
                IdentificadorPosterior = c.IdentificadorPosterior,
                TipoDado = c.TipoDado,
                ConsultaSql = c.ConsultaSql,
                LayoutClienteId = entidadeLayout.Id
            }).ToList();

            await _context.RegioesCampos.AddRangeAsync(novosCampos);
        }

        if (dto.QueriesValidacao != null && dto.QueriesValidacao.Any())
        {
            foreach (var q in dto.QueriesValidacao)
            {
                var novaQueryId = Guid.NewGuid();
                var novaQuery = new QueryValidacao
                {
                    Id = novaQueryId,
                    Nome = q.Nome,
                    Sql = q.Sql,
                    LayoutClienteId = entidadeLayout.Id,
                    Regras = q.Regras?.Select(r => new RegraValidacao
                    {
                        Id = Guid.NewGuid(),
                        CampoRetornado = r.CampoRetornado,
                        Operador = r.Operador,
                        CampoCarne = r.CampoCarne,
                        QueryValidacaoId = novaQueryId
                    }).ToList() ?? new List<RegraValidacao>()
                };

                await _context.QueriesValidacao.AddAsync(novaQuery);
            }
        }

        if (dto.PaginasModeloBase64 != null && dto.PaginasModeloBase64.Any())
        {
            int numeroPagina = 1;
            var novasPaginas = dto.PaginasModeloBase64.Select(img => new PaginaModeloImagem
            {
                Id = Guid.NewGuid(),
                NumeroPagina = numeroPagina++,
                ImagemBase64 = img,
                LayoutClienteId = entidadeLayout.Id
            }).ToList();

            await _context.PaginasModelo.AddRangeAsync(novasPaginas);
        }

        await _context.SaveChangesAsync();
        await transacao.CommitAsync();

        return Ok(entidadeLayout.Id);
    }

    private static bool ImagemEmbutidaValida(string? imagem)
    {
        if (string.IsNullOrEmpty(imagem))
            return false;

        string? prefixo = PrefixosImagemPermitidos.FirstOrDefault(p => imagem.StartsWith(p, StringComparison.OrdinalIgnoreCase));
        if (prefixo == null)
            return false;

        var conteudo = imagem.AsSpan(prefixo.Length);
        foreach (char c in conteudo)
        {
            if (c is not ((>= 'A' and <= 'Z') or (>= 'a' and <= 'z') or (>= '0' and <= '9') or '+' or '/' or '='))
                return false;
        }
        return true;
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> ExcluirLayout(Guid id, [FromBody] ExcluirLayoutRequest request)
    {
        if (!_senhaExclusao.Configurada)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                mensagem = "A exclusão de layouts não está configurada no servidor. Procure o suporte técnico."
            });
        }

        if (!await _senhaExclusao.VerificarAsync(request.SenhaExclusao))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                mensagem = "A senha digitada está incorreta. A exclusão foi cancelada."
            });
        }

        var layout = await _context.Layouts.FindAsync(id);
        if (layout == null)
        {
            return NotFound();
        }

        _context.Layouts.Remove(layout);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}