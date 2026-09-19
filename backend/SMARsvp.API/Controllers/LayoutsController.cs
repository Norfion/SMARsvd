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

    // GET: api/layouts
    // Retorna todos os layouts cadastrados para inicialização no frontend
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
    // Cria ou atualiza um layout com seus campos, conexões e regras
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

        // 1. Tenta localizar por Id fornecido
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

        // 2. Se não encontrou por Id, busca pelo NomeModelo + Cliente
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
            // Remove regras filhas primeiro para manter integridade relacional
            var queriesAntigasIds = entidadeLayout.QueriesValidacao.Select(q => q.Id).ToList();
            if (queriesAntigasIds.Any())
            {
                var regrasAntigas = _context.RegrasValidacao.Where(r => queriesAntigasIds.Contains(r.QueryValidacaoId));
                _context.RegrasValidacao.RemoveRange(regrasAntigas);
            }

            // Remove campos e queries antigas
            _context.RegioesCampos.RemoveRange(entidadeLayout.Campos);
            _context.QueriesValidacao.RemoveRange(entidadeLayout.QueriesValidacao);
            entidadeLayout.Campos.Clear();
            entidadeLayout.QueriesValidacao.Clear();
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

        // 5. Atualização in-place da ConexaoBanco (1:1) para evitar concorrência
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

        // 6. Mapeia os novos campos com novos GUIDs
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

        // 7. Mapeia as novas queries e regras
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
                    CampoRetornado = r.CampoRetornado,
                    Operador = r.Operador,
                    CampoCarne = r.CampoCarne,
                    QueryValidacaoId = novaQueryId
                }).ToList()
            };
        }).ToList();

        // 8. Atualização segura de PaginasModelo (evita colisão de DELETE + UPDATE no EF Core)
        if (dto.PaginasModeloBase64 != null && dto.PaginasModeloBase64.Any())
        {
            var paginasNovas = dto.PaginasModeloBase64.ToList();
            var paginasExistentes = entidadeLayout.PaginasModelo.OrderBy(p => p.NumeroPagina).ToList();

            // Atualiza ou insere página por página mantendo o rastreamento limpo
            for (int i = 0; i < paginasNovas.Count; i++)
            {
                if (i < paginasExistentes.Count)
                {
                    // Atualiza a imagem da página existente sem alterar IDs
                    paginasExistentes[i].ImagemBase64 = paginasNovas[i];
                    paginasExistentes[i].NumeroPagina = i + 1;
                }
                else
                {
                    // Adiciona nova página além das já existentes
                    entidadeLayout.PaginasModelo.Add(new PaginaModeloImagem
                    {
                        Id = Guid.NewGuid(),
                        NumeroPagina = i + 1,
                        ImagemBase64 = paginasNovas[i],
                        LayoutClienteId = entidadeLayout.Id
                    });
                }
            }

            // Remove páginas excedentes caso o novo PDF tenha menos páginas
            if (paginasExistentes.Count > paginasNovas.Count)
            {
                var excedentes = paginasExistentes.Skip(paginasNovas.Count).ToList();
                _context.PaginasModelo.RemoveRange(excedentes);
                foreach (var exc in excedentes)
                {
                    entidadeLayout.PaginasModelo.Remove(exc);
                }
            }
        }

        // 9. Persiste todas as operações em uma única transação atômica consistente
        await _context.SaveChangesAsync();

        return Ok(entidadeLayout.Id);
    }

    // DELETE: api/layouts/{id}
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