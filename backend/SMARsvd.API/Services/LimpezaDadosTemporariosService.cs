using SMARsvd.Application.Interfaces;

namespace SMARsvd.API.Services;

// Remove as pastas temp/{usuario} dos usuários que saíram do sistema (ou pararam de enviar heartbeat)
// há mais tempo que o período de retenção configurado.
public class LimpezaDadosTemporariosService : BackgroundService
{
    private static readonly TimeSpan IntervaloVerificacao = TimeSpan.FromSeconds(30);

    private readonly ISessaoUsuarioService _sessoes;
    private readonly IPastaTemporariaService _pastaTemporaria;
    private readonly ILogger<LimpezaDadosTemporariosService> _logger;
    private readonly TimeSpan _tempoRetencao;

    public LimpezaDadosTemporariosService(
        ISessaoUsuarioService sessoes,
        IPastaTemporariaService pastaTemporaria,
        IConfiguration configuration,
        ILogger<LimpezaDadosTemporariosService> logger)
    {
        _sessoes = sessoes;
        _pastaTemporaria = pastaTemporaria;
        _logger = logger;
        _tempoRetencao = TimeSpan.FromMinutes(configuration.GetValue("DadosTemporarios:MinutosRetencaoAposSaida", 5));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(IntervaloVerificacao);

        do
        {
            try
            {
                LimparDadosDeUsuariosInativos();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao limpar os dados temporários dos usuários.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private void LimparDadosDeUsuariosInativos()
    {
        _sessoes.RemoverSessoesInativas(_tempoRetencao);

        string pastaRaiz = _pastaTemporaria.PastaRaiz;
        if (!Directory.Exists(pastaRaiz))
            return;

        // A raiz de temp/ só deve conter as pastas dos usuários; qualquer arquivo solto é resíduo
        foreach (var arquivo in Directory.GetFiles(pastaRaiz))
        {
            Excluir(arquivo, () => File.Delete(arquivo));
        }

        foreach (var pastaUsuario in Directory.GetDirectories(pastaRaiz))
        {
            string usuario = Path.GetFileName(pastaUsuario);
            if (_sessoes.UsuarioPossuiSessao(usuario))
                continue;

            if (Excluir(pastaUsuario, () => Directory.Delete(pastaUsuario, recursive: true)))
                _logger.LogInformation("Dados temporários do usuário {Usuario} removidos.", usuario);
        }
    }

    // Arquivos ainda em uso são mantidos e a exclusão é tentada novamente na próxima verificação
    private bool Excluir(string caminho, Action exclusao)
    {
        try
        {
            exclusao();
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning("Não foi possível excluir {Caminho}: {Mensagem}", caminho, ex.Message);
            return false;
        }
    }
}
