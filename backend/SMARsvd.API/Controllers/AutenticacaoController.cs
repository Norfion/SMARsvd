using Microsoft.AspNetCore.Mvc;
using SMARsvd.API.Middlewares;
using SMARsvd.API.Models;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AutenticacaoController : ControllerBase
{
    // Atraso aplicado a cada falha para dificultar tentativas sucessivas de senha contra o domínio
    private static readonly TimeSpan AtrasoFalhaLogin = TimeSpan.FromSeconds(1);

    private readonly IAutenticacaoRedeService _autenticacao;
    private readonly ISessaoUsuarioService _sessoes;

    public AutenticacaoController(IAutenticacaoRedeService autenticacao, ISessaoUsuarioService sessoes)
    {
        _autenticacao = autenticacao;
        _sessoes = sessoes;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var resultado = await Task.Run(() => _autenticacao.Autenticar(request.Usuario, request.Senha));

        if (!resultado.Sucesso || resultado.Usuario == null)
        {
            await Task.Delay(AtrasoFalhaLogin);
            return Unauthorized(new { mensagem = resultado.Mensagem });
        }

        string? token = _sessoes.CriarSessao(resultado.Usuario);
        if (token == null)
        {
            return Conflict(new
            {
                mensagem = "Este usuário já está conectado ao sistema em outra aba ou computador. " +
                           "Saia da outra sessão ou aguarde alguns minutos e tente novamente."
            });
        }

        return Ok(new { token, usuario = resultado.Usuario, dominio = _autenticacao.Dominio });
    }

    [HttpGet("sessao")]
    public IActionResult ObterSessao()
    {
        return Ok(new { usuario = HttpContext.ObterUsuarioSessao(), dominio = _autenticacao.Dominio });
    }

    // A atividade é registrada pelo middleware de sessão; o front-end chama periodicamente enquanto a aba está aberta
    [HttpPost("heartbeat")]
    public IActionResult ManterSessaoAtiva()
    {
        return NoContent();
    }

    // Chamado via navigator.sendBeacon ao fechar a aba, que não permite cabeçalhos personalizados
    [HttpPost("encerrar")]
    public IActionResult Encerrar([FromBody] EncerrarSessaoRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Token))
            _sessoes.EncerrarSessao(request.Token);

        return NoContent();
    }
}
