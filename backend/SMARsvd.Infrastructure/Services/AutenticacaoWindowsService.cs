using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Win32.SafeHandles;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

public class AutenticacaoWindowsService : IAutenticacaoRedeService
{
    private const string DominioPadrao = "SMARAPD.COM.BR";

    private const int LOGON32_LOGON_NETWORK = 3;
    private const int LOGON32_PROVIDER_DEFAULT = 0;

    private const int ERROR_LOGON_FAILURE = 1326;
    private const int ERROR_ACCOUNT_RESTRICTION = 1327;
    private const int ERROR_INVALID_LOGON_HOURS = 1328;
    private const int ERROR_PASSWORD_EXPIRED = 1330;
    private const int ERROR_ACCOUNT_DISABLED = 1331;
    private const int ERROR_NO_LOGON_SERVERS = 1311;
    private const int ERROR_ACCOUNT_EXPIRED = 1793;
    private const int ERROR_PASSWORD_MUST_CHANGE = 1907;
    private const int ERROR_ACCOUNT_LOCKED_OUT = 1909;

    // O login vira nome de pasta em temp/, por isso só são aceitos caracteres seguros para o sistema de arquivos
    private static readonly Regex LoginValido = new(@"^[A-Za-z0-9._-]{1,64}$", RegexOptions.CultureInvariant);

    private readonly ILogger<AutenticacaoWindowsService> _logger;

    public string Dominio { get; }

    public AutenticacaoWindowsService(IConfiguration configuration, ILogger<AutenticacaoWindowsService> logger)
    {
        _logger = logger;
        string? dominioConfigurado = configuration.GetValue<string>("Autenticacao:Dominio");
        Dominio = string.IsNullOrWhiteSpace(dominioConfigurado) ? DominioPadrao : dominioConfigurado.Trim();
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool LogonUser(
        string lpszUsername,
        string lpszDomain,
        string lpszPassword,
        int dwLogonType,
        int dwLogonProvider,
        out SafeAccessTokenHandle phToken);

    public ResultadoAutenticacaoRede Autenticar(string usuario, string senha)
    {
        string login = NormalizarLogin(usuario);

        if (string.IsNullOrEmpty(login) || string.IsNullOrEmpty(senha))
            return ResultadoAutenticacaoRede.Falha("Informe o usuário e a senha da rede.");

        if (!LoginValido.IsMatch(login) || login.Trim('.').Length == 0)
            return ResultadoAutenticacaoRede.Falha("O nome de usuário informado contém caracteres inválidos.");

        if (!OperatingSystem.IsWindows())
            return ResultadoAutenticacaoRede.Falha("A autenticação na rede Windows só está disponível quando o servidor roda no Windows.");

        bool autenticado = LogonUser(login, Dominio, senha, LOGON32_LOGON_NETWORK, LOGON32_PROVIDER_DEFAULT, out var token);
        int codigoErro = autenticado ? 0 : Marshal.GetLastWin32Error();
        token.Dispose();

        if (autenticado)
        {
            _logger.LogInformation("Usuário {Usuario} autenticado no domínio {Dominio}.", login, Dominio);
            return ResultadoAutenticacaoRede.Autenticado(login.ToLowerInvariant());
        }

        _logger.LogWarning("Falha de autenticação do usuário {Usuario} no domínio {Dominio}: {Erro}",
            login, Dominio, new Win32Exception(codigoErro).Message);

        return ResultadoAutenticacaoRede.Falha(TraduzirErro(codigoErro));
    }

    private static string NormalizarLogin(string? usuario)
    {
        string login = (usuario ?? string.Empty).Trim();

        int indiceBarra = login.LastIndexOf('\\');
        if (indiceBarra >= 0)
            login = login[(indiceBarra + 1)..];

        int indiceArroba = login.IndexOf('@');
        if (indiceArroba >= 0)
            login = login[..indiceArroba];

        return login.Trim();
    }

    private string TraduzirErro(int codigoErro) => codigoErro switch
    {
        ERROR_LOGON_FAILURE => "Usuário ou senha inválidos.",
        ERROR_ACCOUNT_LOCKED_OUT => "A conta de rede está bloqueada. Procure o suporte de TI.",
        ERROR_ACCOUNT_DISABLED => "A conta de rede está desativada.",
        ERROR_ACCOUNT_EXPIRED => "A conta de rede está expirada.",
        ERROR_PASSWORD_EXPIRED or ERROR_PASSWORD_MUST_CHANGE => "A senha de rede expirou e precisa ser alterada.",
        ERROR_ACCOUNT_RESTRICTION or ERROR_INVALID_LOGON_HOURS => "A conta de rede possui restrições que impedem o acesso neste momento.",
        ERROR_NO_LOGON_SERVERS => $"Não foi possível contatar o domínio {Dominio} para validar as credenciais.",
        _ => "Não foi possível validar as credenciais na rede."
    };
}
