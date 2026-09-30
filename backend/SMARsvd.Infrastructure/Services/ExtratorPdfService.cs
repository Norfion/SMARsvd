using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.Interfaces;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace SMARsvd.Infrastructure.Services;

public class ExtratorPdfService : IExtratorPdfService, IDisposable
{
    private const double FatorMmParaPontos = 72.0 / 25.4;

    // Abrir o PDF a cada leitura torna lotes grandes (10 mil+ páginas) inviáveis,
    // por isso o documento e as palavras da última página lida ficam em cache.
    private string? _caminhoAberto;
    private PdfDocument? _documento;
    private int _paginaEmCache;
    private double _alturaPaginaEmCache;
    private List<Word>? _palavrasEmCache;

    private PdfDocument ObterDocumento(string caminhoArquivo)
    {
        if (_documento != null && string.Equals(_caminhoAberto, caminhoArquivo, StringComparison.OrdinalIgnoreCase))
            return _documento;

        FecharDocumento();
        _documento = PdfDocument.Open(caminhoArquivo);
        _caminhoAberto = caminhoArquivo;
        return _documento;
    }

    private void FecharDocumento()
    {
        _documento?.Dispose();
        _documento = null;
        _caminhoAberto = null;
        _paginaEmCache = 0;
        _alturaPaginaEmCache = 0;
        _palavrasEmCache = null;
    }

    public Task<int> ObterTotalPaginasAsync(string caminhoArquivo)
    {
        return Task.FromResult(ObterDocumento(caminhoArquivo).NumberOfPages);
    }

    public Task<string?> ExtrairTextoDigitalRegiaoAsync(string caminhoArquivo, int numeroPagina, RegiaoCampoDto regiao)
    {
        var pdf = ObterDocumento(caminhoArquivo);

        if (numeroPagina < 1 || numeroPagina > pdf.NumberOfPages)
            return Task.FromResult<string?>(null);

        if (_palavrasEmCache == null || _paginaEmCache != numeroPagina)
        {
            var paginaPdf = pdf.GetPage(numeroPagina);
            _palavrasEmCache = paginaPdf.GetWords().ToList();
            _alturaPaginaEmCache = paginaPdf.Height;
            _paginaEmCache = numeroPagina;
        }

        double alturaPaginaPt = _alturaPaginaEmCache;
        double xMinPt = (double)regiao.XMm * FatorMmParaPontos;
        double xMaxPt = ((double)regiao.XMm + (double)regiao.LarguraMm) * FatorMmParaPontos;

        double yTopPt = alturaPaginaPt - ((double)regiao.YMm * FatorMmParaPontos);
        double yBottomPt = yTopPt - ((double)regiao.AlturaMm * FatorMmParaPontos);

        var palavras = _palavrasEmCache
            .Where(w =>
            {
                bool horizontalValida = w.BoundingBox.Right >= xMinPt && w.BoundingBox.Left <= xMaxPt;
                if (!horizontalValida) return false;

                double overlapTop = Math.Min(w.BoundingBox.Top, yTopPt);
                double overlapBottom = Math.Max(w.BoundingBox.Bottom, yBottomPt);
                double overlapHeight = overlapTop - overlapBottom;

                if (overlapHeight <= 0) return false;

                double midY = (w.BoundingBox.Top + w.BoundingBox.Bottom) / 2.0;

                return (midY >= yBottomPt && midY <= yTopPt) ||
                       (overlapHeight >= w.BoundingBox.Height * 0.5);
            })
            .ToList();

        if (!palavras.Any())
            return Task.FromResult<string?>(null);

        const double toleranciaLinhaPt = 3.0;
        var palavrasOrdenadas = palavras
            .GroupBy(w => Math.Round(w.BoundingBox.Bottom / toleranciaLinhaPt))
            .OrderByDescending(g => g.Key)
            .SelectMany(linha => linha.OrderBy(w => w.BoundingBox.Left))
            .Select(w => w.Text);

        string textoExtraido = string.Join(" ", palavrasOrdenadas).Trim();

        // O tratamento de IdentificadorAnterior foi movido exclusivamente para o ProcessadorCarnesService
        // para garantir que tanto PDF Digital quanto OCR passem pela mesma validação centralizada.

        return Task.FromResult<string?>(string.IsNullOrWhiteSpace(textoExtraido) ? null : textoExtraido);
    }

    public void LiberarArquivo(string caminhoArquivo)
    {
        if (string.Equals(_caminhoAberto, caminhoArquivo, StringComparison.OrdinalIgnoreCase))
            FecharDocumento();
    }

    public void Dispose()
    {
        FecharDocumento();
    }
}
