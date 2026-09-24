using System;
using System.Linq;
using System.Threading.Tasks;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.Interfaces;
using UglyToad.PdfPig;

namespace SMARsvd.Infrastructure.Services;

public class ExtratorPdfService : IExtratorPdfService
{
    private const double FatorMmParaPontos = 72.0 / 25.4;

    public Task<int> ObterTotalPaginasAsync(string caminhoArquivo)
    {
        using var pdf = PdfDocument.Open(caminhoArquivo);
        return Task.FromResult(pdf.NumberOfPages);
    }

    public Task<string?> ExtrairTextoDigitalRegiaoAsync(string caminhoArquivo, int numeroPagina, RegiaoCampoDto regiao)
    {
        using var pdf = PdfDocument.Open(caminhoArquivo);

        if (numeroPagina < 1 || numeroPagina > pdf.NumberOfPages)
            return Task.FromResult<string?>(null);

        var pagina = pdf.GetPage(numeroPagina);

        double alturaPaginaPt = pagina.Height;
        double xMinPt = (double)regiao.XMm * FatorMmParaPontos;
        double xMaxPt = ((double)regiao.XMm + (double)regiao.LarguraMm) * FatorMmParaPontos;

        double yTopPt = alturaPaginaPt - ((double)regiao.YMm * FatorMmParaPontos);
        double yBottomPt = yTopPt - ((double)regiao.AlturaMm * FatorMmParaPontos);

        var palavras = pagina.GetWords()
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
}