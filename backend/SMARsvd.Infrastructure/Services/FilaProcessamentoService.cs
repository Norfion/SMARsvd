using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

// A fila fica apenas em memória, assim como as sessões. Não há timer próprio: os lugares abandonados
// são liberados sempre que alguém consulta a fila, o que acontece a cada poucos segundos enquanto houver espera.
public class FilaProcessamentoService : IFilaProcessamentoService
{
    // O front-end consulta a fila a cada 3 s, mas navegadores espaçam os timers de abas em segundo plano
    private static readonly TimeSpan TempoMaximoSemConsulta = TimeSpan.FromMinutes(2);

    // Devolve a vez de quem a recebeu e parou de executar etapas (aba fechada, queda de rede)
    private static readonly TimeSpan TempoMaximoOciosoComAVez = TimeSpan.FromMinutes(2);

    private sealed class UsuarioAguardando
    {
        public UsuarioAguardando(string usuario, DateTime agora)
        {
            Usuario = usuario;
            UltimaConsultaUtc = agora;
        }

        public string Usuario { get; }
        public DateTime UltimaConsultaUtc { get; set; }
    }

    private readonly object _sync = new();
    private readonly List<UsuarioAguardando> _aguardando = new();

    private string? _usuarioComAVez;
    private DateTime _ultimaAtividadeComAVezUtc;
    private int _etapasEmAndamento;
    private bool _devolverVezAoConcluirEtapas;

    public SituacaoFilaProcessamento Entrar(string usuario, bool aguardarNaFila)
    {
        lock (_sync)
        {
            var agora = DateTime.UtcNow;
            RemoverAbandonados(agora);

            if (MesmoUsuario(_usuarioComAVez, usuario))
            {
                if (_etapasEmAndamento > 0)
                    return new SituacaoFilaProcessamento(SituacaoFila.ProcessamentoEmAndamento);

                _devolverVezAoConcluirEtapas = false;
                _ultimaAtividadeComAVezUtc = agora;
                return new SituacaoFilaProcessamento(SituacaoFila.Liberado);
            }

            int indice = _aguardando.FindIndex(a => MesmoUsuario(a.Usuario, usuario));
            if (indice >= 0)
            {
                _aguardando[indice].UltimaConsultaUtc = agora;
                return new SituacaoFilaProcessamento(SituacaoFila.NaFila, indice + 1);
            }

            if (_usuarioComAVez == null)
            {
                ConcederVez(usuario, agora);
                return new SituacaoFilaProcessamento(SituacaoFila.Liberado);
            }

            if (!aguardarNaFila)
                return new SituacaoFilaProcessamento(SituacaoFila.Ocupado, _aguardando.Count + 1);

            _aguardando.Add(new UsuarioAguardando(usuario, agora));
            return new SituacaoFilaProcessamento(SituacaoFila.NaFila, _aguardando.Count);
        }
    }

    public void Sair(string usuario)
    {
        lock (_sync)
        {
            _aguardando.RemoveAll(a => MesmoUsuario(a.Usuario, usuario));

            if (MesmoUsuario(_usuarioComAVez, usuario))
            {
                if (_etapasEmAndamento > 0)
                    _devolverVezAoConcluirEtapas = true;
                else
                    DevolverVez(DateTime.UtcNow);
            }
        }
    }

    public bool IniciarEtapa(string usuario)
    {
        lock (_sync)
        {
            if (!MesmoUsuario(_usuarioComAVez, usuario))
                return false;

            _etapasEmAndamento++;
            _ultimaAtividadeComAVezUtc = DateTime.UtcNow;
            return true;
        }
    }

    public void FinalizarEtapa(string usuario)
    {
        lock (_sync)
        {
            if (!MesmoUsuario(_usuarioComAVez, usuario))
                return;

            var agora = DateTime.UtcNow;
            _etapasEmAndamento = Math.Max(0, _etapasEmAndamento - 1);
            _ultimaAtividadeComAVezUtc = agora;

            if (_etapasEmAndamento == 0 && _devolverVezAoConcluirEtapas)
                DevolverVez(agora);
        }
    }

    private void RemoverAbandonados(DateTime agora)
    {
        _aguardando.RemoveAll(a => agora - a.UltimaConsultaUtc > TempoMaximoSemConsulta);

        if (_usuarioComAVez != null
            && _etapasEmAndamento == 0
            && agora - _ultimaAtividadeComAVezUtc > TempoMaximoOciosoComAVez)
        {
            DevolverVez(agora);
        }
        else if (_usuarioComAVez == null)
        {
            ConcederVezAoProximo(agora);
        }
    }

    private void DevolverVez(DateTime agora)
    {
        _usuarioComAVez = null;
        _etapasEmAndamento = 0;
        _devolverVezAoConcluirEtapas = false;
        ConcederVezAoProximo(agora);
    }

    private void ConcederVezAoProximo(DateTime agora)
    {
        if (_aguardando.Count == 0)
            return;

        var proximo = _aguardando[0];
        _aguardando.RemoveAt(0);
        ConcederVez(proximo.Usuario, agora);
    }

    private void ConcederVez(string usuario, DateTime agora)
    {
        _usuarioComAVez = usuario;
        _ultimaAtividadeComAVezUtc = agora;
        _etapasEmAndamento = 0;
        _devolverVezAoConcluirEtapas = false;
    }

    private static bool MesmoUsuario(string? a, string? b) =>
        a != null && b != null && string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}
