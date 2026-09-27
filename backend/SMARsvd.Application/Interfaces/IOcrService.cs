namespace SMARsvd.Application.Interfaces;

public interface IOcrService
{
    // Quantidade de regiões que podem passar pelo OCR ao mesmo tempo
    int MaximoParalelismo { get; }

    // Interface preparada para futura integração com IA/Visão Computacional
    Task<string> ExtrairTextoPorOcrAsync(string caminhoArquivo, int numeroPagina, decimal x, decimal y, decimal largura, decimal altura);

    // Descarta o documento e as páginas renderizadas mantidos em cache para o arquivo
    void LiberarArquivo(string caminhoArquivo);
}
