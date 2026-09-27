<<<<<<< HEAD
using Microsoft.EntityFrameworkCore;
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
using SMARsvd.Application.DTOs;
using SMARsvd.Application.Interfaces;
using SMARsvd.Domain.Entities;
using SMARsvd.Infrastructure.Data;

namespace SMARsvd.Infrastructure.Services;

public class LogService : ILogService
{
<<<<<<< HEAD
    private static readonly string[] TiposDeFalha = { "Erro", "Exceção", "Aviso" };

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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

        _context.Logs.Add(log);
        await _context.SaveChangesAsync();
    }
<<<<<<< HEAD

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
=======
}
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
