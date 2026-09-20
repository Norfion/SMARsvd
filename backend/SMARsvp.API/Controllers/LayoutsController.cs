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

        // 1. Localiza pelo GUID se enviado
        if (dto.Id.HasValue && dto.Id.Value != Guid.Empty)
        {
            entidadeLayout = await _context.Layouts
                .Include(l => l.ConexaoBanco)
                .FirstOrDefaultAsync(l => l.Id == dto.Id.Value);
        }

        // 2. Se não encontrou por ID, tenta por NomeModelo + Cliente
        if (entidadeLayout == null && !string.IsNullOrWhiteSpace(dto.NomeModelo) && !string.IsNullOrWhiteSpace(dto.Cliente))
        {
            var nomeBusca = dto.NomeModelo.Trim().ToLower();
            var clienteBusca = dto.Cliente.Trim().ToLower();

            entidadeLayout = await _context.Layouts
                .Include(l => l.ConexaoBanco)
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
            // 4. Limpeza isolada e direta das coleções antigas vinculadas ao layout
            var layoutId = entidadeLayout.Id;

            // Remove regras das queries antigas
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

            // Persiste a remoção dos filhos no banco
            await _context.SaveChangesAsync();
        }

        // 5. Atualiza os dados principais do Layout
        entidadeLayout.Cliente = dto.Cliente;
        entidadeLayout.NomeModelo = dto.NomeModelo;
        entidadeLayout.Versao = dto.Versao;
        entidadeLayout.Orientacao = orientacaoEnum;
        entidadeLayout.FormatoPapel = formatoEnum;
        entidadeLayout.LarguraPaginaMm = dto.LarguraPaginaMm;
        entidadeLayout.AlturaPaginaMm = dto.AlturaPaginaMm;
        entidadeLayout.QuantidadePaginasPadrao = dto.QuantidadePaginasPadrao;
        entidadeLayout.NomeArquivoModelo = dto.NomeArquivoModelo;

        // 6. Atualização in-place da ConexaoBanco (evita DELETE + UPDATE concorrente)
        if (dto.ConexaoBanco != null && !string.IsNullOrWhiteSpace(dto.ConexaoBanco.Servidor))
        {
            if (entidadeLayout.ConexaoBanco != null)
            {
                entidadeLayout.ConexaoBanco.Provedor = dto.ConexaoBanco.Provedor ?? "SQL Server";
                entidadeLayout.ConexaoBanco.Servidor = dto.ConexaoBanco.Servidor.Trim();
                entidadeLayout.ConexaoBanco.Porta = dto.ConexaoBanco.Porta;
                entidadeLayout.ConexaoBanco.Usuario = dto.ConexaoBanco.Usuario.Trim();
                entidadeLayout.ConexaoBanco.Senha = dto.ConexaoBanco.Senha;
            }
            else
            {
                entidadeLayout.ConexaoBanco = new ConexaoBancoLayout
                {
                    Id = Guid.NewGuid(),
                    LayoutClienteId = entidadeLayout.Id,
                    Provedor = dto.ConexaoBanco.Provedor ?? "SQL Server",
                    Servidor = dto.ConexaoBanco.Servidor.Trim(),
                    Porta = dto.ConexaoBanco.Porta,
                    Usuario = dto.ConexaoBanco.Usuario.Trim(),
                    Senha = dto.ConexaoBanco.Senha
                };
            }
        }
        else if (entidadeLayout.ConexaoBanco != null)
        {
            _context.ConexoesBanco.Remove(entidadeLayout.ConexaoBanco);
            entidadeLayout.ConexaoBanco = null;
        }

        // 7. Insere os novos campos mapeados
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
                EhIdentificadorPrimeiraPagina = c.EhIdentificadorPrimeiraPagina,
                TextoEsperadoIdentificador = c.TextoEsperadoIdentificador,
                ConsultaSql = c.ConsultaSql,
                LayoutClienteId = entidadeLayout.Id
            }).ToList();

            await _context.RegioesCampos.AddRangeAsync(novosCampos);
        }

        // 8. Insere as novas queries e regras
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

        // 9. Insere as imagens das páginas
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

        // 10. Persiste as alterações e novas coleções de forma limpa
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