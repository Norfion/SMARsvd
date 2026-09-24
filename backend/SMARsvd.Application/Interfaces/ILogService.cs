using SMARsvd.Application.DTOs;

namespace SMARsvd.Application.Interfaces;

public interface ILogService
{
    Task RegistrarLogAsync(LogCriacaoDto dto);
}