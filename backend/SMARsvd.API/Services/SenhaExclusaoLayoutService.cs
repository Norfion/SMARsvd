using System.Security.Cryptography;
using System.Text;

namespace SMARsvd.API.Services;

// A senha de confirmação da exclusão de layouts fica apenas no servidor, como hash PBKDF2 no formato
// "PBKDF2-SHA256$<iterações>$<salt em Base64>$<hash em Base64>" (Layouts:SenhaExclusaoHash).
public class SenhaExclusaoLayoutService
{
    private const string Algoritmo = "PBKDF2-SHA256";
    private const string SenhaPadraoAntiga = "teste123";
    private static readonly TimeSpan AtrasoFalha = TimeSpan.FromSeconds(1);

    // As verificações são feitas uma por vez, para que o atraso após cada erro não seja contornado com requisições paralelas
    private readonly SemaphoreSlim _verificacao = new(1, 1);

    private readonly int _iteracoes;
    private readonly byte[]? _salt;
    private readonly byte[]? _hash;

    public bool Configurada => _hash != null;

    public SenhaExclusaoLayoutService(IConfiguration configuration, ILogger<SenhaExclusaoLayoutService> logger)
    {
        string? configurado = configuration.GetValue<string>("Layouts:SenhaExclusaoHash");
        if (string.IsNullOrWhiteSpace(configurado))
        {
            logger.LogWarning("Layouts:SenhaExclusaoHash não está configurado; a exclusão de layouts ficará bloqueada.");
            return;
        }

        string[] partes = configurado.Trim().Split('$');
        try
        {
            if (partes.Length != 4 || partes[0] != Algoritmo || !int.TryParse(partes[1], out _iteracoes) || _iteracoes < 10_000)
                throw new FormatException();

            _salt = Convert.FromBase64String(partes[2]);
            _hash = Convert.FromBase64String(partes[3]);
        }
        catch (FormatException)
        {
            _salt = null;
            _hash = null;
            logger.LogError("Layouts:SenhaExclusaoHash está em formato inválido; a exclusão de layouts ficará bloqueada.");
            return;
        }

        if (Comparar(SenhaPadraoAntiga))
            logger.LogWarning("A senha de exclusão de layouts ainda é a senha padrão. Altere Layouts:SenhaExclusaoHash no appsettings.json.");
    }

    public async Task<bool> VerificarAsync(string? senha)
    {
        await _verificacao.WaitAsync();
        try
        {
            bool correta = Configurada && !string.IsNullOrEmpty(senha) && Comparar(senha);
            if (!correta)
                await Task.Delay(AtrasoFalha);
            return correta;
        }
        finally
        {
            _verificacao.Release();
        }
    }

    private bool Comparar(string senha)
    {
        if (_salt == null || _hash == null)
            return false;

        byte[] calculado = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(senha), _salt, _iteracoes, HashAlgorithmName.SHA256, _hash.Length);
        return CryptographicOperations.FixedTimeEquals(calculado, _hash);
    }
}
