using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Domain.Entities;
using SMARsvp.Domain.Enums;
using SMARsvp.Infrastructure.Data;

namespace SMARsvp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LayoutsController : ControllerBase
{
    private readonly SMARsvpDbContext _context;

    public LayoutsController(SMARsvpDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LayoutClienteDto>>> ListarTodos()
    {
        var layouts = await _context.Layouts
            .Include(l => l.ConexaoBanco)
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
            Orientacao = l.Orientacao.ToString(),
            FormatoPapel = l.FormatoPapel.ToString(),
            LarguraPaginaMm = l.LarguraPaginaMm,
            AlturaPaginaMm = l.AlturaPaginaMm,
            QuantidadePaginasPadrao = l.QuantidadePaginasPadrao,
            NomeArquivoModelo = l.NomeArquivoModelo,
            ConexaoBanco = l.ConexaoBanco == null ? null : new ConexaoBancoLayoutDto
            {
                Provedor = l.ConexaoBanco.Provedor,
                Servidor = l.ConexaoBanco.Servidor,
                Porta = l.ConexaoBanco.Porta,
                Usuario = l.ConexaoBanco.Usuario,
                Senha = l.ConexaoBanco.Senha
            },
            Campos = l.Campos.Select(c => new RegiaoCampoDto
            {
                Id = c.Id,
                NomeCampo = c.NomeCampo,
                XMm = c.XMm,
                YMm = c.YMm,
                LarguraMm = c.LarguraMm,
                AlturaMm = c.AlturaMm,
                Pagina = c.Pagina,
                EhIdentificadorPrimeiraPagina = c.EhIdentificadorPrimeiraPagina,
                TextoEsperadoIdentificador = c.TextoEsperadoIdentificador,
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

        Enum.TryParse<OrientacaoPagina>(dto.Orientacao, true, out var orientacaoEnum);
        Enum.TryParse<FormatoPapel>(dto.FormatoPapel, true, out var formatoEnum);

        LayoutCliente? entidadeLayout = null;

        // 1. Tenta localizar pelo GUID enviado pelo frontend
        if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
        {
            entidadeLayout = await _context.Layouts
                .Include(l => l.ConexaoBanco)
                .Include(l => l.Campos)
                .Include(l => l.QueriesValidacao)
                    .ThenInclude(q => q.Regras)
                .Include(l => l.PaginasModelo)
                .AsSplitQuery()
                .FirstOrDefaultAsync(l => l.Id == dto.Id.Value);
        }

        // 2. Se não encontrou por ID, verifica pelo NomeModelo + Cliente
        if (entidadeLayout == null && !string.IsNullOrWhiteSpace(dto.NomeModelo) && !string.IsNullOrWhiteSpace(dto.Cliente))
        {
            var nomeBusca = dto.NomeModelo.Trim().ToLower();
            var clienteBusca = dto.Cliente.Trim().ToLower();

            entidadeLayout = await _context.Layouts
                .Include(l => l.ConexaoBanco)
                .Include(l => l.Campos)
                .Include(l => l.QueriesValidacao)
                    .ThenInclude(q => q.Regras)
                .Include(l => l.PaginasModelo)
                .AsSplitQuery()
                .FirstOrDefaultAsync(l => l.NomeModelo.ToLower() == nomeBusca && l.Cliente.ToLower() == clienteBusca);
        }

        // 3. Se for novo layout, cria a entidade base
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
            var queriesAntigasIds = entidadeLayout.QueriesValidacao.Select(q => q.Id).ToList();
            if (queriesAntigasIds.Any())
            {
                var regrasAntigas = _context.RegrasValidacao.Where(r => queriesAntigasIds.Contains(r.QueryValidacaoId));
                _context.RegrasValidacao.RemoveRange(regrasAntigas);
            }

            _context.RegioesCampos.RemoveRange(entidadeLayout.Campos);
            _context.QueriesValidacao.RemoveRange(entidadeLayout.QueriesValidacao);
            _context.PaginasModelo.RemoveRange(entidadeLayout.PaginasModelo);

            // IMPORTANTE: Esvazia as coleções rastreadas em memória para desvincular os proxies do EF Core
            entidadeLayout.Campos.Clear();
            entidadeLayout.QueriesValidacao.Clear();
            entidadeLayout.PaginasModelo.Clear();
        }

        // 4. Atualiza os dados principais do Layout
        entidadeLayout.Cliente = dto.Cliente;
        entidadeLayout.NomeModelo = dto.NomeModelo;
        entidadeLayout.Versao = dto.Versao;
        entidadeLayout.Orientacao = orientacaoEnum;
        entidadeLayout.FormatoPapel = formatoEnum;
        entidadeLayout.LarguraPaginaMm = dto.LarguraPaginaMm;
        entidadeLayout.AlturaPaginaMm = dto.AlturaPaginaMm;
        entidadeLayout.QuantidadePaginasPadrao = dto.QuantidadePaginasPadrao;
        entidadeLayout.NomeArquivoModelo = dto.NomeArquivoModelo;

        // 5. Atualização in-place da ConexaoBanco
        if (dto.ConexaoBanco != null && !string.IsNullOrWhiteSpace(dto.ConexaoBanco.Servidor))
        {
            if (entidadeLayout.ConexaoBanco != null)
            {
                entidadeLayout.ConexaoBanco.Provedor = dto.ConexaoBanco.Provedor ?? "SQL Server";
                entidadeLayout.ConexaoBanco.Servidor = dto.ConexaoBanco.Servidor;
                entidadeLayout.ConexaoBanco.Porta = dto.ConexaoBanco.Porta;
                entidadeLayout.ConexaoBanco.Usuario = dto.ConexaoBanco.Usuario;
                entidadeLayout.ConexaoBanco.Senha = dto.ConexaoBanco.Senha;
            }
            else
            {
                entidadeLayout.ConexaoBanco = new ConexaoBancoLayout
                {
                    Id = Guid.NewGuid(),
                    LayoutClienteId = entidadeLayout.Id,
                    Provedor = dto.ConexaoBanco.Provedor ?? "SQL Server",
                    Servidor = dto.ConexaoBanco.Servidor,
                    Porta = dto.ConexaoBanco.Porta,
                    Usuario = dto.ConexaoBanco.Usuario,
                    Senha = dto.ConexaoBanco.Senha
                };
            }
        }
        else if (entidadeLayout.ConexaoBanco != null)
        {
            _context.ConexoesBanco.Remove(entidadeLayout.ConexaoBanco);
            entidadeLayout.ConexaoBanco = null;
        }

        // 6. Adiciona novos campos à coleção monitorada sem sobrescrevê-la
        if (dto.Campos != null)
        {
            foreach (var c in dto.Campos)
            {
                entidadeLayout.Campos.Add(new RegiaoCampo
                {
                    Id = Guid.NewGuid(),
                    NomeCampo = c.NomeCampo,
                    XMm = c.XMm,
                    YMm = c.YMm,
                    LarguraMm = c.LarguraMm,
                    AlturaMm = c.AlturaMm,
                    Pagina = c.Pagina,
                    EhIdentificadorPrimeiraPagina = c.EhIdentificadorPrimeiraPagina,
                    TextoEsperadoIdentificador = c.TextoEsperadoIdentificador,
                    ConsultaSql = c.ConsultaSql,
                    LayoutClienteId = entidadeLayout.Id
                });
            }
        }

        // 7. Adiciona novas queries à coleção monitorada
        if (dto.QueriesValidacao != null)
        {
            foreach (var q in dto.QueriesValidacao)
            {
                var novaQueryId = Guid.NewGuid();
                entidadeLayout.QueriesValidacao.Add(new QueryValidacao
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
                });
            }
        }

        // 8. Adiciona páginas à coleção monitorada
        if (dto.PaginasModeloBase64 != null && dto.PaginasModeloBase64.Any())
        {
            int numeroPagina = 1;
            foreach (var img in dto.PaginasModeloBase64)
            {
                entidadeLayout.PaginasModelo.Add(new PaginaModeloImagem
                {
                    Id = Guid.NewGuid(),
                    NumeroPagina = numeroPagina++,
                    ImagemBase64 = img,
                    LayoutClienteId = entidadeLayout.Id
                });
            }
        }

        // 9. Persiste tudo em uma única transação atômica limpa
        await _context.SaveChangesAsync();

        return Ok(entidadeLayout.Id);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> ExcluirLayout(Guid id)
    {
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