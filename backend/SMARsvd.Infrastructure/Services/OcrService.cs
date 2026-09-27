using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SMARsvd.Application.Interfaces;
using Tesseract;
using Docnet.Core;
using Docnet.Core.Models;
using Docnet.Core.Readers;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace SMARsvd.Infrastructure.Services;

public class OcrService : IOcrService, IDisposable
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<OcrService> _logger;
    private readonly TesseractEngine? _engine;
    private readonly bool _ocrEnabled;
    private static readonly object _syncLock = new();

    // Documento e última página renderizada ficam em cache: vários campos da mesma página
    // reaproveitam a renderização e o PDF não é reaberto a cada chamada.
    private readonly object _renderLock = new();
    private string? _caminhoRenderizado;
    private IDocReader? _docReader;
    private int _paginaRenderizada;
    private byte[]? _bytesPaginaRenderizada;
    private int _larguraPaginaRenderizada;
    private int _alturaPaginaRenderizada;

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
                // Sem isso o Tesseract imprime estatísticas no console a cada região, degradando lotes grandes
                _engine.SetVariable("debug_file", OperatingSystem.IsWindows() ? "NUL" : "/dev/null");
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
            string candidato = Path.Combine(diretorioPai, "SMARsvd.IA", "Models", "OCR", "tessdata");
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
            // 1. Renderiza a página preservando a proporção de 300 DPI (~11.81 px/mm)
            // Para A4: Retrato (2480x3508) ou Paisagem (3508x2480)
            var (rawBytes, renderWidth, renderHeight) = RenderizarPagina(caminhoArquivo, numeroPagina);

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

    private (byte[] Bytes, int Largura, int Altura) RenderizarPagina(string caminhoArquivo, int numeroPagina)
    {
        lock (_renderLock)
        {
            if (_docReader == null || !string.Equals(_caminhoRenderizado, caminhoArquivo, StringComparison.OrdinalIgnoreCase))
            {
                FecharDocumento();
                _docReader = DocLib.Instance.GetDocReader(caminhoArquivo, new PageDimensions(3508, 3508));
                _caminhoRenderizado = caminhoArquivo;
            }

            if (_bytesPaginaRenderizada == null || _paginaRenderizada != numeroPagina)
            {
                using var pageReader = _docReader.GetPageReader(numeroPagina - 1);
                _bytesPaginaRenderizada = pageReader.GetImage();
                _larguraPaginaRenderizada = pageReader.GetPageWidth();
                _alturaPaginaRenderizada = pageReader.GetPageHeight();
                _paginaRenderizada = numeroPagina;
            }

            return (_bytesPaginaRenderizada, _larguraPaginaRenderizada, _alturaPaginaRenderizada);
        }
    }

    private void FecharDocumento()
    {
        _docReader?.Dispose();
        _docReader = null;
        _caminhoRenderizado = null;
        _paginaRenderizada = 0;
        _bytesPaginaRenderizada = null;
        _larguraPaginaRenderizada = 0;
        _alturaPaginaRenderizada = 0;
    }

    public void LiberarArquivo(string caminhoArquivo)
    {
        lock (_renderLock)
        {
            if (string.Equals(_caminhoRenderizado, caminhoArquivo, StringComparison.OrdinalIgnoreCase))
                FecharDocumento();
        }
    }

    public void Dispose()
    {
        lock (_renderLock)
        {
            FecharDocumento();
        }
        _engine?.Dispose();
    }
}