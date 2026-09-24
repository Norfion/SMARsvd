using SMARsvd.Application.DTOs;
using SMARsvd.Application.Interfaces;
using SMARsvd.Domain.Entities;
using SMARsvd.Infrastructure.Data;

namespace SMARsvd.Infrastructure.Services;

public class LogService : ILogService
{
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
}