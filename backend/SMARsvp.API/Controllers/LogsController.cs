using Microsoft.AspNetCore.Mvc;
using SMARsvp.Application.DTOs;
using SMARsvp.Application.Interfaces;

namespace SMARsvp.API.Controllers;

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