using System.Linq;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.Interfaces;
using UglyToad.PdfPig;

namespace SMARsvp.Infrastructure.Services;

public class ExtratorPdfService : IExtratorPdfService
{
    // 1 ponto tipográfico (pt) = 25.4 / 72 mm (~0.352778 mm)
    // 1 mm = 72 / 25.4 pt (~2.83465 pt)
    private const double FatorMmParaPontos = 72.0 / 25.4;

    public Task<int> ObterTotalPaginasAsync(string caminhoArquivo)
    {
        // Abre apenas para ler o cabeçalho/quantidade de páginas sem sobrecarregar a memória
        using var pdf = PdfDocument.Open(caminhoArquivo);
        return Task.FromResult(pdf.NumberOfPages);
    }

    public Task<string?> ExtrairTextoDigitalRegiaoAsync(string caminhoArquivo, int numeroPagina, RegiaoCampoDto regiao)
    {
        using var pdf = PdfDocument.Open(caminhoArquivo);

        if (numeroPagina < 1 || numeroPagina > pdf.NumberOfPages)
            return Task.FromResult<string?>(null);

        var pagina = pdf.GetPage(numeroPagina);

        // O PDF mede coordenadas a partir do canto INFERIOR esquerdo (Y = 0 na base)
        // No layout visual da tela, o Y começa no canto SUPERIOR esquerdo (Y = 0 no topo)
        double alturaPaginaPt = pagina.Height;

        double xMinPt = (double)regiao.XMm * FatorMmParaPontos;
        double xMaxPt = ((double)regiao.XMm + (double)regiao.LarguraMm) * FatorMmParaPontos;

        // Inversão do eixo Y para corresponder ao topo da página
        double yTopPt = alturaPaginaPt - ((double)regiao.YMm * FatorMmParaPontos);
        double yBottomPt = yTopPt - ((double)regiao.AlturaMm * FatorMmParaPontos);

        // Filtra as palavras com intersecção na caixa delimitadora
        var palavras = pagina.GetWords()
            .Where(w =>
                w.BoundingBox.Right >= xMinPt &&
                w.BoundingBox.Left <= xMaxPt &&
                w.BoundingBox.Top >= yBottomPt &&
                w.BoundingBox.Bottom <= yTopPt)
            .ToList();

        if (!palavras.Any())
            return Task.FromResult<string?>(null);

        // Agrupa palavras que pertencem à mesma linha visual (tolerância vertical de ~3 pontos tipográficos)
        // e ordena da esquerda para a direita (BoundingBox.Left)
        const double toleranciaLinhaPt = 3.0;
        var palavrasOrdenadas = palavras
            .GroupBy(w => Math.Round(w.BoundingBox.Bottom / toleranciaLinhaPt))
            .OrderByDescending(g => g.Key) // Linhas de cima para baixo
            .SelectMany(linha => linha.OrderBy(w => w.BoundingBox.Left)) // Palavras da esquerda para a direita
            .Select(w => w.Text);

        string textoExtraido = string.Join(" ", palavrasOrdenadas).Trim();

        return Task.FromResult<string?>(string.IsNullOrWhiteSpace(textoExtraido) ? null : textoExtraido);
    }
}