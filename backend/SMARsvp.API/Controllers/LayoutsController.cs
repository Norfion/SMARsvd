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

        if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
        {
            entidadeLayout = await _context.Layouts
                .Include(l => l.ConexaoBanco)
                .Include(l => l.Campos)
                .Include(l => l.QueriesValidacao)
                    .ThenInclude(q => q.Regras)
                .Include(l => l.PaginasModelo)
                .FirstOrDefaultAsync(l => l.Id == dto.Id.Value);
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
            _context.RegioesCampos.RemoveRange(entidadeLayout.Campos);
            _context.QueriesValidacao.RemoveRange(entidadeLayout.QueriesValidacao);
            _context.PaginasModelo.RemoveRange(entidadeLayout.PaginasModelo);
            if (entidadeLayout.ConexaoBanco != null)
            {
                _context.ConexoesBanco.Remove(entidadeLayout.ConexaoBanco);
            }
        }

        entidadeLayout.Cliente = dto.Cliente;
        entidadeLayout.NomeModelo = dto.NomeModelo;
        entidadeLayout.Versao = dto.Versao;
        entidadeLayout.Orientacao = orientacaoEnum;
        entidadeLayout.FormatoPapel = formatoEnum;
        entidadeLayout.LarguraPaginaMm = dto.LarguraPaginaMm;
        entidadeLayout.AlturaPaginaMm = dto.AlturaPaginaMm;
        entidadeLayout.QuantidadePaginasPadrao = dto.QuantidadePaginasPadrao;
        entidadeLayout.NomeArquivoModelo = dto.NomeArquivoModelo;

        if (dto.ConexaoBanco != null && !string.IsNullOrWhiteSpace(dto.ConexaoBanco.Servidor))
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
            ConsultaSql = c.ConsultaSql,
            LayoutClienteId = entidadeLayout.Id
        }).ToList();

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