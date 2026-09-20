using SMARsvp.Application.DTOs;
using SMARsvp.Application.Interfaces;
using SMARsvp.Domain.Entities;
using SMARsvp.Infrastructure.Data;

namespace SMARsvp.Infrastructure.Services;

public class LogService : ILogService
{
    private readonly SMARsvpDbContext _context;

    public LogService(SMARsvpDbContext context)
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
}