using Microsoft.AspNetCore.Mvc;
using SMARsvd.Application.DTOs;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LogsController : ControllerBase
{
    private readonly ILogService _logService;

    public LogsController(ILogService logService)
    {
        _logService = logService;
    }

    [HttpPost]
    public async Task<IActionResult> RegistrarLog([FromBody] LogCriacaoDto request)
    {
        await _logService.RegistrarLogAsync(request);
        return Ok();
    }
}