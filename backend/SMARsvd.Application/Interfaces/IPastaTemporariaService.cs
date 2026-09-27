namespace SMARsvd.Application.Interfaces;

public interface IPastaTemporariaService
{
    string PastaRaiz { get; }

    // Cria (se necessário) e devolve a pasta temporária exclusiva do usuário: temp/{usuario}
    string ObterPastaUsuario(string usuario);
}
