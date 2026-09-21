using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SMARsvp.Application.Interfaces;
using Tesseract;
using Docnet.Core;
using Docnet.Core.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace SMARsvp.Infrastructure.Services;

public class OcrService : IOcrService, IDisposable
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<OcrService> _logger;
    private readonly TesseractEngine? _engine;
    private readonly bool _ocrEnabled;
    private static readonly object _syncLock = new();

    public OcrService(IConfiguration configuration, ILogger<OcrService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _ocrEnabled = _configuration.GetValue<bool>("OCR:Enabled");

        if (_ocrEnabled)
        {
            string tessConfigPath = _configuration.GetValue<string>("OCR:ModelPath") ?? "./tessdata";
            string language = _configuration.GetValue<string>("OCR:Language") ?? "por";

            // Localiza a pasta tessdata de forma resiliente subindo diretórios até a raiz da solução
            string tessDataPath = ResolverCaminhoTessdata(tessConfigPath);

            try
            {
                _engine = new TesseractEngine(tessDataPath, language, EngineMode.Default);
                _logger.LogInformation("Tesseract OCR inicializado com sucesso no caminho: {Path}", tessDataPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao inicializar o modelo Tesseract no caminho: {Path}", tessDataPath);
                _engine = null;
            }
        }
    }

    private static string ResolverCaminhoTessdata(string caminhoConfigurado)
    {
        if (Path.IsPathRooted(caminhoConfigurado) && Directory.Exists(caminhoConfigurado))
            return caminhoConfigurado;

        string caminhoAtual = Path.GetFullPath(caminhoConfigurado);
        if (Directory.Exists(caminhoAtual))
            return caminhoAtual;

        string caminhoBase = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, caminhoConfigurado));
        if (Directory.Exists(caminhoBase))
            return caminhoBase;

        string? diretorioPai = Directory.GetCurrentDirectory();
        while (diretorioPai != null)
        {
            string candidato = Path.Combine(diretorioPai, "SMARsvp.IA", "Models", "OCR", "tessdata");
            if (Directory.Exists(candidato))
                return candidato;

            diretorioPai = Directory.GetParent(diretorioPai)?.FullName;
        }

        return caminhoConfigurado;
    }

    public async Task<string> ExtrairTextoPorOcrAsync(string caminhoArquivo, int numeroPagina, decimal x, decimal y, decimal largura, decimal altura)
    {
        if (!_ocrEnabled || _engine == null)
        {
            _logger.LogWarning("Tentativa de OCR abortada. O serviço está desabilitado ou o modelo não foi carregado.");
            return string.Empty;
        }

        try
        {
            byte[] rawBytes;
            int renderWidth;
            int renderHeight;

            // 1. Renderiza a página preservando a proporção de 300 DPI (~11.81 px/mm)
            // Para A4: Retrato (2480x3508) ou Paisagem (3508x2480)
            using (var docReader = DocLib.Instance.GetDocReader(caminhoArquivo, new PageDimensions(3508, 3508)))
            {
                using var pageReader = docReader.GetPageReader(numeroPagina - 1);
                rawBytes = pageReader.GetImage();
                renderWidth = pageReader.GetPageWidth();
                renderHeight = pageReader.GetPageHeight();
            }

            if (renderWidth <= 0 || renderHeight <= 0 || rawBytes == null || rawBytes.Length == 0)
                return string.Empty;

            // 2. Carrega a imagem da página
            using var imagem = Image.LoadPixelData<Bgra32>(rawBytes, renderWidth, renderHeight);

            // 3. Define as dimensões reais em mm da folha conforme a orientação detectada
            double paginaLarguraMm = renderWidth >= renderHeight ? 297.0 : 210.0;
            double paginaAlturaMm = renderWidth >= renderHeight ? 210.0 : 297.0;

            // Fatores de conversão reais (pixels por milímetro)
            double escalaXPxPorMm = (double)renderWidth / paginaLarguraMm;
            double escalaYPxPorMm = (double)renderHeight / paginaAlturaMm;

            int cropX = (int)Math.Max(0, (double)x * escalaXPxPorMm);
            int cropY = (int)Math.Max(0, (double)y * escalaYPxPorMm);
            int cropW = (int)Math.Min(imagem.Width - cropX, (double)largura * escalaXPxPorMm);
            int cropH = (int)Math.Min(imagem.Height - cropY, (double)altura * escalaYPxPorMm);

            if (cropW <= 0 || cropH <= 0)
                return string.Empty;

            var cropRect = new SixLabors.ImageSharp.Rectangle(cropX, cropY, cropW, cropH);

            // 4. Recorta a região e aplica pré-processamento otimizado
            imagem.Mutate(ctx =>
            {
                ctx.Crop(cropRect);

                if (_configuration.GetValue<bool>("OCR:UsePreProcessing", true))
                {
                    ctx.Grayscale();

                    // Upscaling 2x para garantir boa definição de fontes pequenas
                    int novaLargura = cropRect.Width * 2;
                    int novaAltura = cropRect.Height * 2;
                    ctx.Resize(novaLargura, novaAltura, KnownResamplers.Bicubic);

                    // Melhora o contraste e nitidez sem eliminar letras por binarização extrema
                    ctx.Contrast(1.35f);
                    ctx.GaussianSharpen(0.75f);
                }
            });

            // 5. Converte para PNG em memória
            using var ms = new MemoryStream();
            await imagem.SaveAsPngAsync(ms);
            var bytesPng = ms.ToArray();

            // 6. Execução do OCR com descarte imediato do Page e proteção contra concorrência
            return await Task.Run(() =>
            {
                lock (_syncLock)
                {
                    using var pix = Pix.LoadFromMemory(bytesPng);
                    string texto = string.Empty;

                    // Tentativa 1: SingleBlock (resiliente para blocos e múltiplas palavras)
                    using (var page = _engine.Process(pix, PageSegMode.SingleBlock))
                    {
                        texto = page.GetText()?.Trim() ?? string.Empty;
                    } // page é descartada imediatamente aqui, liberando a engine

                    // Fallback: se retornar vazio, tenta SingleLine garantindo a engine livre
                    if (string.IsNullOrWhiteSpace(texto))
                    {
                        using (var pageLinha = _engine.Process(pix, PageSegMode.SingleLine))
                        {
                            texto = pageLinha.GetText()?.Trim() ?? string.Empty;
                        }
                    }

                    return texto;
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no OCR do documento {Arquivo}, Página {Pagina}", caminhoArquivo, numeroPagina);
            return string.Empty;
        }
    }

    public void Dispose()
    {
        _engine?.Dispose();
    }
}