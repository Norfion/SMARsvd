using SMARsvd.Application.DTOs;

namespace SMARsvd.Application.Interfaces;

public interface ILogService
{
    Task RegistrarLogAsync(LogCriacaoDto dto);
<<<<<<< HEAD
    Task<List<LogRegistroDto>> ListarFalhasPorPeriodoAsync(DateTime inicioUtc, DateTime fimUtc);
}
=======
}
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
