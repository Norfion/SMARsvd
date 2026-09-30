using Microsoft.AspNetCore.Mvc;
using SMARsvd.API.Middlewares;
using SMARsvd.API.Models;
using SMARsvd.API.Services;
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
    private readonly LimitadorTentativasLogin _limitador;

    public AutenticacaoController(IAutenticacaoRedeService autenticacao, ISessaoUsuarioService sessoes, LimitadorTentativasLogin limitador)
    {
        _autenticacao = autenticacao;
        _sessoes = sessoes;
        _limitador = limitador;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (_limitador.ObterBloqueioRestante(request.Usuario) is { } bloqueio)
            return RespostaBloqueio(bloqueio);

        if (!await _limitador.AguardarVagaAsync())
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                mensagem = "O servidor está recebendo muitas tentativas de login. Aguarde alguns instantes e tente novamente."
            });
        }

        ResultadoAutenticacaoRede resultado;
        try
        {
            resultado = await Task.Run(() => _autenticacao.Autenticar(request.Usuario, request.Senha));

            if (!resultado.Sucesso || resultado.Usuario == null)
            {
                _limitador.RegistrarFalha(request.Usuario);
                await Task.Delay(AtrasoFalhaLogin);
            }
        }
        finally
        {
            _limitador.LiberarVaga();
        }

        if (!resultado.Sucesso || resultado.Usuario == null)
        {
            if (_limitador.ObterBloqueioRestante(request.Usuario) is { } bloqueioAposFalha)
                return RespostaBloqueio(bloqueioAposFalha);

            return Unauthorized(new { mensagem = resultado.Mensagem });
        }

        _limitador.RegistrarSucesso(request.Usuario);

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

    private IActionResult RespostaBloqueio(TimeSpan restante)
    {
        int minutos = Math.Max(1, (int)Math.Ceiling(restante.TotalMinutes));
        Response.Headers.RetryAfter = ((int)Math.Ceiling(restante.TotalSeconds)).ToString();
        return StatusCode(StatusCodes.Status429TooManyRequests, new
        {
            mensagem = $"Muitas tentativas de login sem sucesso para este usuário. Aguarde {minutos} minuto(s) e tente novamente."
        });
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
