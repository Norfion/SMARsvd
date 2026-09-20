using SMARsvp.Application.DTOs.Layout;

namespace SMARsvp.Application.Interfaces;

public interface IExtratorPdfService
{
    // Retorna o total de páginas de um arquivo PDF no disco
    Task<int> ObterTotalPaginasAsync(string caminhoArquivo);

    // Lê apenas uma página específica e tenta extrair o texto de uma região delimitada
    Task<string?> ExtrairTextoDigitalRegiaoAsync(string caminhoArquivo, int numeroPagina, RegiaoCampoDto regiao);
}