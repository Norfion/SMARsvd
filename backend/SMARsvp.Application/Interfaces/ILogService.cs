using SMARsvp.Application.DTOs;

namespace SMARsvp.Application.Interfaces;

public interface ILogService
{
    Task RegistrarLogAsync(LogCriacaoDto dto);
}