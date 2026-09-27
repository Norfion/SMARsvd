using SMARsvd.Application.DTOs.Layout;

namespace SMARsvd.Application.Interfaces;

public interface IExtratorPdfService
{
    // Retorna o total de páginas de um arquivo PDF no disco
    Task<int> ObterTotalPaginasAsync(string caminhoArquivo);

    // Lê apenas uma página específica e tenta extrair o texto de uma região delimitada
    Task<string?> ExtrairTextoDigitalRegiaoAsync(string caminhoArquivo, int numeroPagina, RegiaoCampoDto regiao);
<<<<<<< HEAD

    // Fecha o documento mantido em cache para o arquivo, liberando o bloqueio sobre ele no disco
    void LiberarArquivo(string caminhoArquivo);
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
}