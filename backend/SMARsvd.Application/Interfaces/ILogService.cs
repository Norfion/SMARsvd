using SMARsvd.Application.DTOs;

namespace SMARsvd.Application.Interfaces;

public interface ILogService
{
    Task RegistrarLogAsync(LogCriacaoDto dto);
    Task<List<LogRegistroDto>> ListarFalhasPorPeriodoAsync(DateTime inicioUtc, DateTime fimUtc, string usuario);
}
