using Microsoft.EntityFrameworkCore;
using SMARsvd.Application.DTOs;
using SMARsvd.Application.Interfaces;
using SMARsvd.Domain.Entities;
using SMARsvd.Infrastructure.Data;

namespace SMARsvd.Infrastructure.Services;

public class LogService : ILogService
{
    private static readonly string[] TiposDeFalha = { "Erro", "Exceção", "Aviso" };

    // O SQLite aceita um único escritor por vez: as gravações de log de todos os usuários passam por aqui
    // em sequência, sem disputar o bloqueio do arquivo entre si.
    private static readonly SemaphoreSlim GravacaoLog = new(1, 1);

    private readonly SMARsvdDbContext _context;

    public LogService(SMARsvdDbContext context)
    {
        _context = context;
    }

    public async Task RegistrarLogAsync(LogCriacaoDto dto)
    {
        var log = new LogSistema
        {
            Tipo = dto.Tipo,
            Mensagem = dto.Mensagem,
            Origem = dto.Origem,
            StackTrace = dto.StackTrace,
            Detalhes = dto.Detalhes,
            DataHora = DateTime.UtcNow // Padrão recomendado para logs
        };

        await GravacaoLog.WaitAsync();
        try
        {
            _context.Logs.Add(log);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch
            {
                // Sem isso, o log que falhou seria regravado no próximo SaveChanges da mesma requisição
                _context.Entry(log).State = EntityState.Detached;
                throw;
            }
        }
        finally
        {
            GravacaoLog.Release();
        }
    }

    public async Task<List<LogRegistroDto>> ListarFalhasPorPeriodoAsync(DateTime inicioUtc, DateTime fimUtc)
    {
        var logs = await _context.Logs
            .AsNoTracking()
            .Where(l => l.DataHora >= inicioUtc && l.DataHora <= fimUtc && TiposDeFalha.Contains(l.Tipo))
            .OrderBy(l => l.DataHora)
            .ToListAsync();

        // O SQLite devolve o DateTime sem Kind; os logs são sempre gravados em UTC.
        return logs.Select(l => new LogRegistroDto
        {
            Tipo = l.Tipo,
            Mensagem = l.Mensagem,
            Origem = l.Origem,
            DataHora = DateTime.SpecifyKind(l.DataHora, DateTimeKind.Utc),
            Detalhes = l.Detalhes
        }).ToList();
    }
}
