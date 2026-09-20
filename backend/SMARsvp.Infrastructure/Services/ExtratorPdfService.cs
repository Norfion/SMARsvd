using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
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

        // Filtra as palavras cujo ponto central ou maior parte da altura pertença à caixa delimitadora.
        // Isso impede que caracteres altos ou acentos de linhas adjacentes vazem para dentro da extração.
        var palavras = pagina.GetWords()
            .Where(w =>
            {
                // 1. Verificação horizontal
                bool horizontalValida = w.BoundingBox.Right >= xMinPt && w.BoundingBox.Left <= xMaxPt;
                if (!horizontalValida) return false;

                // 2. Verificação vertical com tolerância a vazamento de linha:
                double overlapTop = Math.Min(w.BoundingBox.Top, yTopPt);
                double overlapBottom = Math.Max(w.BoundingBox.Bottom, yBottomPt);
                double overlapHeight = overlapTop - overlapBottom;

                if (overlapHeight <= 0) return false;

                // Centro vertical da palavra
                double midY = (w.BoundingBox.Top + w.BoundingBox.Bottom) / 2.0;

                // A palavra é aceita se o seu ponto central estiver dentro da demarcação
                // OU se pelo menos 50% de sua altura física estiver contida no retângulo demarcado.
                return (midY >= yBottomPt && midY <= yTopPt) ||
                       (overlapHeight >= w.BoundingBox.Height * 0.5);
            })
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

        if (string.IsNullOrWhiteSpace(textoExtraido))
            return Task.FromResult<string?>(null);

        // Tratamento do Identificador Anterior:
        // Caso o usuário tenha informado um prefixo (ex: "RUA:", "CRC", "CPF:"),
        // localizamos a ocorrência e extraímos apenas o conteúdo subsequente.
        if (!string.IsNullOrWhiteSpace(regiao.IdentificadorAnterior))
        {
            string identificador = regiao.IdentificadorAnterior.Trim();

            // 1. Busca exata (insensível a maiúsculas e minúsculas)
            int indiceIdentificador = textoExtraido.IndexOf(identificador, StringComparison.OrdinalIgnoreCase);

            if (indiceIdentificador >= 0)
            {
                textoExtraido = textoExtraido.Substring(indiceIdentificador + identificador.Length).Trim();
            }
            else
            {
                // 2. Busca resiliente com Regex caso haja variações de espaçamento (ex: "CRC :" vs "CRC:")
                string padraoEscapado = Regex.Escape(identificador).Replace(@"\:", @"\s*\:\s*").Replace(@"\-", @"\s*\-\s*");
                var match = Regex.Match(textoExtraido, padraoEscapado, RegexOptions.IgnoreCase);

                if (match.Success)
                {
                    textoExtraido = textoExtraido.Substring(match.Index + match.Length).Trim();
                }
            }

            // Remove pontuações residuais soltas que possam ter sobrado logo após o delimitador (ex: ":", "-")
            textoExtraido = textoExtraido.TrimStart(':', '-', ' ');
        }

        return Task.FromResult<string?>(string.IsNullOrWhiteSpace(textoExtraido) ? null : textoExtraido);
    }
}