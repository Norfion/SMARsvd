namespace SMARsvp.Application.Interfaces;

public interface IOcrService
{
    // Interface preparada para futura integração com IA/Visão Computacional
    Task<string> ExtrairTextoPorOcrAsync(string caminhoArquivo, int numeroPagina, decimal x, decimal y, decimal largura, decimal altura);
}