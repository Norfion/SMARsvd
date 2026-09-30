using Microsoft.Extensions.Configuration;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

public class PastaTemporariaService : IPastaTemporariaService
{
    public string PastaRaiz { get; }

    public PastaTemporariaService(IConfiguration configuration)
    {
        string? pastaConfigurada = configuration.GetValue<string>("DadosTemporarios:Pasta");
        string pastaTemp;

        if (!string.IsNullOrWhiteSpace(pastaConfigurada))
        {
            pastaTemp = Path.GetFullPath(pastaConfigurada);
        }
        else
        {
            pastaTemp = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "database", "temp"));
            if (!Directory.Exists(Path.GetDirectoryName(pastaTemp)))
            {
                pastaTemp = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database", "temp"));
            }
        }

        Directory.CreateDirectory(pastaTemp);
        PastaRaiz = pastaTemp;
    }

    public string ObterPastaUsuario(string usuario)
    {
        if (string.IsNullOrWhiteSpace(usuario)
            || usuario.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
            || usuario.Trim('.').Length == 0)
        {
            throw new ArgumentException("Usuário inválido para a pasta temporária.", nameof(usuario));
        }

        string pastaUsuario = Path.GetFullPath(Path.Combine(PastaRaiz, usuario.ToLowerInvariant()));
        if (!string.Equals(Path.GetDirectoryName(pastaUsuario), PastaRaiz, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Usuário inválido para a pasta temporária.", nameof(usuario));

        Directory.CreateDirectory(pastaUsuario);
        return pastaUsuario;
    }
}
