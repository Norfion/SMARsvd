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

    // O DbContext é injetado automaticamente pelo .NET
    public LayoutsController(SMARsvpDbContext context)
    {
        _context = context;
    }

    // GET: api/layouts
    // Retorna todos os layouts cadastrados para carregar na inicialização do React
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LayoutClienteDto>>> ListarTodos()
    {
        var layouts = await _context.Layouts
            .Include(l => l.Campos)
            .Include(l => l.QueriesValidacao)
                .ThenInclude(q => q.Regras)
            .Include(l => l.PaginasModelo)
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
                TextoEsperadoIdentificador = c.TextoEsperadoIdentificador
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
    // Recebe o payload do layout desenhado no front e grava no SQL Server
    [HttpPost]
    public async Task<ActionResult<Guid>> SalvarLayout([FromBody] LayoutClienteDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // Converter string de Enum para os Enums seguros de domínio
        Enum.TryParse<OrientacaoPagina>(dto.Orientacao, true, out var orientacaoEnum);
        Enum.TryParse<FormatoPapel>(dto.FormatoPapel, true, out var formatoEnum);

        LayoutCliente? entidadeLayout = null;

        // Se já vier com Id, tenta localizar para atualizar
        if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
        {
            entidadeLayout = await _context.Layouts
                .Include(l => l.Campos)
                .Include(l => l.QueriesValidacao)
                    .ThenInclude(q => q.Regras)
                .Include(l => l.PaginasModelo)
                .FirstOrDefaultAsync(l => l.Id == dto.Id.Value);
        }

        // Se não existir, criamos um novo
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
            // Limpa as coleções antigas para recriar as regiões e regras atualizadas
            _context.RegioesCampos.RemoveRange(entidadeLayout.Campos);
            _context.QueriesValidacao.RemoveRange(entidadeLayout.QueriesValidacao);
            _context.PaginasModelo.RemoveRange(entidadeLayout.PaginasModelo);
        }

        // Mapeia os dados do DTO para a Entidade de Banco
        entidadeLayout.Cliente = dto.Cliente;
        entidadeLayout.NomeModelo = dto.NomeModelo;
        entidadeLayout.Versao = dto.Versao;
        entidadeLayout.Orientacao = orientacaoEnum;
        entidadeLayout.FormatoPapel = formatoEnum;
        entidadeLayout.LarguraPaginaMm = dto.LarguraPaginaMm;
        entidadeLayout.AlturaPaginaMm = dto.AlturaPaginaMm;
        entidadeLayout.QuantidadePaginasPadrao = dto.QuantidadePaginasPadrao;
        entidadeLayout.NomeArquivoModelo = dto.NomeArquivoModelo;

        // Mapeia os campos/coordenadas demarcadas
        entidadeLayout.Campos = dto.Campos.Select(c => new RegiaoCampo
        {
            Id = c.Id.HasValue && c.Id.Value != Guid.Empty ? c.Id.Value : Guid.NewGuid(),
            NomeCampo = c.NomeCampo,
            XMm = c.XMm,
            YMm = c.YMm,
            LarguraMm = c.LarguraMm,
            AlturaMm = c.AlturaMm,
            Pagina = c.Pagina,
            EhIdentificadorPrimeiraPagina = c.EhIdentificadorPrimeiraPagina,
            TextoEsperadoIdentificador = c.TextoEsperadoIdentificador,
            LayoutClienteId = entidadeLayout.Id
        }).ToList();

        // Mapeia as queries e regras de validação
        entidadeLayout.QueriesValidacao = dto.QueriesValidacao.Select(q => new QueryValidacao
        {
            Id = q.Id.HasValue && q.Id.Value != Guid.Empty ? q.Id.Value : Guid.NewGuid(),
            Nome = q.Nome,
            Sql = q.Sql,
            LayoutClienteId = entidadeLayout.Id,
            Regras = q.Regras.Select(r => new RegraValidacao
            {
                Id = r.Id.HasValue && r.Id.Value != Guid.Empty ? r.Id.Value : Guid.NewGuid(),
                CampoRetornado = r.CampoRetornado,
                Operador = r.Operador,
                CampoCarne = r.CampoCarne
            }).ToList()
        }).ToList();

        // Mapeia as imagens de gabarito (se houver)
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