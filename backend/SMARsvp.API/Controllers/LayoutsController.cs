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

    // POST: api/layouts
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

        // 1. Busca layout por ID
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

        // 2. Busca por Nome e Cliente se não encontrou por ID
        if (entidadeLayout == null)
        {
            entidadeLayout = await _context.Layouts
                .Include(l => l.ConexaoBanco)
                .Include(l => l.Campos)
                .Include(l => l.QueriesValidacao)
                    .ThenInclude(q => q.Regras)
                .Include(l => l.PaginasModelo)
                .AsSplitQuery()
                .FirstOrDefaultAsync(l => l.NomeModelo.ToLower() == dto.NomeModelo.Trim().ToLower()
                                       && l.Cliente.ToLower() == dto.Cliente.Trim().ToLower());
        }

        // 3. Se for novo registro, instancia e adiciona ao contexto
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
            // 4. Limpa as coleções filhas diretamente via contexto
            var queriesAntigasIds = entidadeLayout.QueriesValidacao.Select(q => q.Id).ToList();
            if (queriesAntigasIds.Any())
            {
                var regrasAntigas = _context.RegrasValidacao.Where(r => queriesAntigasIds.Contains(r.QueryValidacaoId));
                _context.RegrasValidacao.RemoveRange(regrasAntigas);
            }

            _context.RegioesCampos.RemoveRange(entidadeLayout.Campos);
            _context.QueriesValidacao.RemoveRange(entidadeLayout.QueriesValidacao);
            _context.PaginasModelo.RemoveRange(entidadeLayout.PaginasModelo);

            // ---> ADIÇÃO CRÍTICA: Persiste a exclusão no SQLite ANTES de limpar a memória
            await _context.SaveChangesAsync();

            // Desassocia da memória local para evitar colisões no ChangeTracker
            entidadeLayout.Campos.Clear();
            entidadeLayout.QueriesValidacao.Clear();
            entidadeLayout.PaginasModelo.Clear();
        }

        // 5. Atualiza as propriedades principais do Layout
        entidadeLayout.Cliente = dto.Cliente;
        entidadeLayout.NomeModelo = dto.NomeModelo;
        entidadeLayout.Versao = dto.Versao;
        entidadeLayout.Orientacao = orientacaoEnum;
        entidadeLayout.FormatoPapel = formatoEnum;
        entidadeLayout.LarguraPaginaMm = dto.LarguraPaginaMm;
        entidadeLayout.AlturaPaginaMm = dto.AlturaPaginaMm;
        entidadeLayout.QuantidadePaginasPadrao = dto.QuantidadePaginasPadrao;
        entidadeLayout.NomeArquivoModelo = dto.NomeArquivoModelo;

        // 6. Atualiza a Conexão com Banco (1:1) sem recriar o ID se já existir
        if (dto.ConexaoBanco != null && !string.IsNullOrWhiteSpace(dto.ConexaoBanco.Servidor))
        {
            if (entidadeLayout.ConexaoBanco == null)
            {
                entidadeLayout.ConexaoBanco = new ConexaoBancoLayout
                {
                    Id = Guid.NewGuid(),
                    LayoutClienteId = entidadeLayout.Id
                };
            }

            entidadeLayout.ConexaoBanco.Provedor = dto.ConexaoBanco.Provedor ?? "SQL Server";
            entidadeLayout.ConexaoBanco.Servidor = dto.ConexaoBanco.Servidor;
            entidadeLayout.ConexaoBanco.Porta = dto.ConexaoBanco.Porta;
            entidadeLayout.ConexaoBanco.Usuario = dto.ConexaoBanco.Usuario;
            entidadeLayout.ConexaoBanco.Senha = dto.ConexaoBanco.Senha;
        }
        else if (entidadeLayout.ConexaoBanco != null)
        {
            _context.ConexoesBanco.Remove(entidadeLayout.ConexaoBanco);
            entidadeLayout.ConexaoBanco = null;
        }

        // 7. Recria as novas entidades com novos GUIDs
        entidadeLayout.Campos = dto.Campos.Select(c => new RegiaoCampo
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
        }).ToList();

        entidadeLayout.QueriesValidacao = dto.QueriesValidacao.Select(q =>
        {
            var novaQueryId = Guid.NewGuid();
            return new QueryValidacao
            {
                Id = novaQueryId,
                Nome = q.Nome,
                Sql = q.Sql,
                LayoutClienteId = entidadeLayout.Id,
                Regras = q.Regras.Select(r => new RegraValidacao
                {
                    Id = Guid.NewGuid(),
                    QueryValidacaoId = novaQueryId,
                    CampoRetornado = r.CampoRetornado,
                    Operador = r.Operador,
                    CampoCarne = r.CampoCarne
                }).ToList()
            };
        }).ToList();

        if (dto.PaginasModeloBase64 != null)
        {
            int numeroPagina = 1;
            entidadeLayout.PaginasModelo = dto.PaginasModeloBase64.Select(img => new PaginaModeloImagem
            {
                Id = Guid.NewGuid(),
                NumeroPagina = numeroPagina++,
                ImagemBase64 = img,
                LayoutClienteId = entidadeLayout.Id
            }).ToList();
        }

        // 8. Uma única persistência atômica
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