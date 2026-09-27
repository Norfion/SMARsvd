using System.Security.Cryptography;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

// As sessões ficam apenas em memória: reiniciar a API invalida todas e exige novo login
public class SessaoUsuarioService : ISessaoUsuarioService
{
    private sealed class SessaoUsuario
    {
        public SessaoUsuario(string usuario)
        {
            Usuario = usuario;
            UltimaAtividadeUtc = DateTime.UtcNow;
        }

        public string Usuario { get; }
        public DateTime UltimaAtividadeUtc { get; set; }
        public DateTime? EncerradaEmUtc { get; set; }
        public int RequisicoesEmAndamento { get; set; }

        public DateTime InativaDesdeUtc => EncerradaEmUtc ?? UltimaAtividadeUtc;
    }

    // O front-end envia heartbeat a cada 45 s, mas navegadores espaçam os timers de abas em segundo plano
    private static readonly TimeSpan TempoMaximoSemAtividadeEmUso = TimeSpan.FromMinutes(2);

    private readonly Dictionary<string, SessaoUsuario> _sessoes = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public string? CriarSessao(string usuario)
    {
        string token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        lock (_sync)
        {
            var agora = DateTime.UtcNow;
            var sessoesDoUsuario = _sessoes
                .Where(s => string.Equals(s.Value.Usuario, usuario, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (sessoesDoUsuario.Any(s => EstaEmUso(s.Value, agora)))
                return null;

            foreach (var sessaoAnterior in sessoesDoUsuario)
                _sessoes.Remove(sessaoAnterior.Key);

            _sessoes[token] = new SessaoUsuario(usuario);
        }

        return token;
    }

    private static bool EstaEmUso(SessaoUsuario sessao, DateTime agora) =>
        sessao.RequisicoesEmAndamento > 0
        || (sessao.EncerradaEmUtc == null && agora - sessao.UltimaAtividadeUtc < TempoMaximoSemAtividadeEmUso);

    public string? IniciarRequisicao(string token)
    {
        lock (_sync)
        {
            if (!_sessoes.TryGetValue(token, out var sessao))
                return null;

            sessao.UltimaAtividadeUtc = DateTime.UtcNow;
            sessao.EncerradaEmUtc = null;
            sessao.RequisicoesEmAndamento++;
            return sessao.Usuario;
        }
    }

    public void FinalizarRequisicao(string token)
    {
        lock (_sync)
        {
            if (!_sessoes.TryGetValue(token, out var sessao))
                return;

            sessao.RequisicoesEmAndamento = Math.Max(0, sessao.RequisicoesEmAndamento - 1);
            sessao.UltimaAtividadeUtc = DateTime.UtcNow;
        }
    }

    public void EncerrarSessao(string token)
    {
        lock (_sync)
        {
            if (_sessoes.TryGetValue(token, out var sessao))
                sessao.EncerradaEmUtc = DateTime.UtcNow;
        }
    }

    public void RemoverSessoesInativas(TimeSpan tempoMaximoInatividade)
    {
        var limite = DateTime.UtcNow - tempoMaximoInatividade;

        lock (_sync)
        {
            var tokensExpirados = _sessoes
                .Where(s => s.Value.RequisicoesEmAndamento == 0 && s.Value.InativaDesdeUtc <= limite)
                .Select(s => s.Key)
                .ToList();

            foreach (var token in tokensExpirados)
                _sessoes.Remove(token);
        }
    }

    public bool UsuarioPossuiSessao(string usuario)
    {
        lock (_sync)
        {
            return _sessoes.Values.Any(s => string.Equals(s.Usuario, usuario, StringComparison.OrdinalIgnoreCase));
        }
    }
}
