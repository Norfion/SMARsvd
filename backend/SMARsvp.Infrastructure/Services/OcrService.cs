using SMARsvp.Application.Interfaces;

namespace SMARsvp.Infrastructure.Services;

public class OcrService : IOcrService
{
    public Task<string> ExtrairTextoPorOcrAsync(string caminhoArquivo, int numeroPagina, decimal x, decimal y, decimal largura, decimal altura)
    {
        // Abstração para futura integração com OCR/IA
        return Task.FromResult(string.Empty);
    }
}