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

        // Filtra todas as palavras que possuem intersecção com o retângulo demarcado.
        var palavrasNaRegiao = pagina.GetWords()
                    .Where(w =>
                        w.BoundingBox.Right >= xMinPt &&
                        w.BoundingBox.Left <= xMaxPt &&
                        w.BoundingBox.Top >= yBottomPt &&
                        w.BoundingBox.Bottom <= yTopPt)
                    .OrderByDescending(w => w.BoundingBox.Top)
                    .ThenBy(w => w.BoundingBox.Left)
                    .Select(w => w.Text);

        string textoExtraido = string.Join(" ", palavrasNaRegiao).Trim();

        return Task.FromResult<string?>(string.IsNullOrWhiteSpace(textoExtraido) ? null : textoExtraido);
    }
}