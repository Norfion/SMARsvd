namespace SMARsvd.API.Services;

// Protege as contas do domínio contra tentativas repetidas de senha: após várias falhas seguidas o login do usuário
// fica bloqueado por alguns minutos no SMARsvd (antes que o próprio domínio bloqueie a conta), e o número de
// validações simultâneas é limitado para que o atraso por falha não seja contornado com requisições em paralelo.
public class LimitadorTentativasLogin
{
    private const int MaximoFalhas = 5;
    private static readonly TimeSpan JanelaFalhas = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan TempoBloqueio = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan EsperaMaximaVaga = TimeSpan.FromSeconds(30);

    private sealed class RegistroFalhas
    {
        public int Quantidade { get; set; }
        public DateTime PrimeiraFalhaUtc { get; set; }
        public DateTime? BloqueadoAteUtc { get; set; }
    }

    private readonly Dictionary<string, RegistroFalhas> _falhas = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _sync = new();
    private readonly SemaphoreSlim _vagas = new(4, 4);

    public TimeSpan? ObterBloqueioRestante(string? usuario)
    {
        string chave = Normalizar(usuario);
        lock (_sync)
        {
            if (!_falhas.TryGetValue(chave, out var registro) || registro.BloqueadoAteUtc == null)
                return null;

            var restante = registro.BloqueadoAteUtc.Value - DateTime.UtcNow;
            if (restante > TimeSpan.Zero)
                return restante;

            _falhas.Remove(chave);
            return null;
        }
    }

    public void RegistrarFalha(string? usuario)
    {
        string chave = Normalizar(usuario);
        var agora = DateTime.UtcNow;

        lock (_sync)
        {
            RemoverExpirados(agora);

            if (!_falhas.TryGetValue(chave, out var registro) || agora - registro.PrimeiraFalhaUtc > JanelaFalhas)
            {
                registro = new RegistroFalhas { PrimeiraFalhaUtc = agora };
                _falhas[chave] = registro;
            }

            registro.Quantidade++;
            if (registro.Quantidade >= MaximoFalhas)
                registro.BloqueadoAteUtc = agora + TempoBloqueio;
        }
    }

    public void RegistrarSucesso(string? usuario)
    {
        lock (_sync)
        {
            _falhas.Remove(Normalizar(usuario));
        }
    }

    public Task<bool> AguardarVagaAsync() => _vagas.WaitAsync(EsperaMaximaVaga);

    public void LiberarVaga() => _vagas.Release();

    private void RemoverExpirados(DateTime agora)
    {
        var expirados = _falhas
            .Where(f => agora - f.Value.PrimeiraFalhaUtc > JanelaFalhas
                        && (f.Value.BloqueadoAteUtc == null || f.Value.BloqueadoAteUtc <= agora))
            .Select(f => f.Key)
            .ToList();

        foreach (var chave in expirados)
            _falhas.Remove(chave);
    }

    // Mesma normalização do login (DOMINIO\usuario e usuario@dominio contam como o mesmo usuário)
    private static string Normalizar(string? usuario)
    {
        string login = (usuario ?? string.Empty).Trim();

        int indiceBarra = login.LastIndexOf('\\');
        if (indiceBarra >= 0)
            login = login[(indiceBarra + 1)..];

        int indiceArroba = login.IndexOf('@');
        if (indiceArroba >= 0)
            login = login[..indiceArroba];

        return login.Trim().ToLowerInvariant();
    }
}
