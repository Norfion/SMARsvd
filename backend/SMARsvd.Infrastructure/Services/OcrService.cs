using System.Collections.Concurrent;
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
    private readonly bool _ocrEnabled;
    private readonly string _tessDataPath = string.Empty;
    private readonly string _idioma = string.Empty;
    private readonly bool _motorDisponivel;

    // Um TesseractEngine só reconhece uma imagem por vez. O pool mantém um motor por região em paralelo,
    // criados sob demanda até o limite, para não recarregar o modelo a cada chamada.
    private readonly ConcurrentBag<TesseractEngine> _motoresLivres = new();
    private readonly SemaphoreSlim _vagasMotor;

    // Documento e páginas renderizadas ficam em cache por arquivo: vários campos da mesma página
    // reaproveitam a renderização e o PDF não é reaberto a cada chamada.
    private readonly Dictionary<string, DocumentoRenderizado> _documentos = new(StringComparer.OrdinalIgnoreCase);

    public int MaximoParalelismo { get; }

    public OcrService(IConfiguration configuration, ILogger<OcrService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _ocrEnabled = _configuration.GetValue<bool>("OCR:Enabled");

        // Cada motor e cada página renderizada em cache ocupam dezenas de MB, por isso o padrão é conservador
        int paralelismoConfigurado = _configuration.GetValue("OCR:MaximoParalelismo", 0);
        MaximoParalelismo = paralelismoConfigurado > 0
            ? paralelismoConfigurado
            : Math.Clamp(Environment.ProcessorCount / 2, 1, 4);
        _vagasMotor = new SemaphoreSlim(MaximoParalelismo, MaximoParalelismo);

        if (_ocrEnabled)
        {
            string tessConfigPath = _configuration.GetValue<string>("OCR:ModelPath") ?? "./tessdata";
            _idioma = _configuration.GetValue<string>("OCR:Language") ?? "por";

            // Localiza a pasta tessdata de forma resiliente subindo diretórios até a raiz da solução
            _tessDataPath = ResolverCaminhoTessdata(tessConfigPath);

            try
            {
                _motoresLivres.Add(CriarMotor());
                _motorDisponivel = true;
                _logger.LogInformation("Tesseract OCR inicializado com sucesso no caminho: {Path} (até {Paralelismo} regiões em paralelo)",
                    _tessDataPath, MaximoParalelismo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao inicializar o modelo Tesseract no caminho: {Path}", _tessDataPath);
            }
        }
    }

    private TesseractEngine CriarMotor()
    {
        var motor = new TesseractEngine(_tessDataPath, _idioma, EngineMode.Default);
        // Sem isso o Tesseract imprime estatísticas no console a cada região, degradando lotes grandes
        motor.SetVariable("debug_file", OperatingSystem.IsWindows() ? "NUL" : "/dev/null");
        return motor;
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
        if (!_ocrEnabled || !_motorDisponivel)
        {
            _logger.LogWarning("Tentativa de OCR abortada. O serviço está desabilitado ou o modelo não foi carregado.");
            return string.Empty;
        }

        try
        {
            // 1. Renderiza a página preservando a proporção de 300 DPI (~11.81 px/mm)
            // Para A4: Retrato (2480x3508) ou Paisagem (3508x2480)
            var pagina = ObterDocumento(caminhoArquivo).Renderizar(numeroPagina);
            int renderWidth = pagina.Largura;
            int renderHeight = pagina.Altura;

            if (renderWidth <= 0 || renderHeight <= 0 || pagina.Bytes.Length == 0)
                return string.Empty;

            // 2. Carrega a imagem da página
            using var imagem = Image.LoadPixelData<Bgra32>(pagina.Bytes, renderWidth, renderHeight);

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

            // 6. Execução do OCR com um motor exclusivo do pool, descartando o Page imediatamente
            var motor = await ObterMotorAsync();
            try
            {
                return await Task.Run(() => Reconhecer(motor, bytesPng));
            }
            finally
            {
                DevolverMotor(motor);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro no OCR do documento {Arquivo}, Página {Pagina}", caminhoArquivo, numeroPagina);
            return string.Empty;
        }
    }

    private static string Reconhecer(TesseractEngine motor, byte[] bytesPng)
    {
        using var pix = Pix.LoadFromMemory(bytesPng);
        string texto;

        // Tentativa 1: SingleBlock (resiliente para blocos e múltiplas palavras)
        using (var page = motor.Process(pix, PageSegMode.SingleBlock))
        {
            texto = page.GetText()?.Trim() ?? string.Empty;
        } // page é descartada imediatamente aqui, liberando o motor

        // Fallback: se retornar vazio, tenta SingleLine garantindo o motor livre
        if (string.IsNullOrWhiteSpace(texto))
        {
            using var pageLinha = motor.Process(pix, PageSegMode.SingleLine);
            texto = pageLinha.GetText()?.Trim() ?? string.Empty;
        }

        return texto;
    }

    private async Task<TesseractEngine> ObterMotorAsync()
    {
        await _vagasMotor.WaitAsync();

        if (_motoresLivres.TryTake(out var motor))
            return motor;

        try
        {
            return CriarMotor();
        }
        catch
        {
            _vagasMotor.Release();
            throw;
        }
    }

    private void DevolverMotor(TesseractEngine motor)
    {
        _motoresLivres.Add(motor);
        _vagasMotor.Release();
    }

    private DocumentoRenderizado ObterDocumento(string caminhoArquivo)
    {
        lock (_documentos)
        {
            if (!_documentos.TryGetValue(caminhoArquivo, out var documento))
            {
                // Mantém em cache as páginas sendo lidas em paralelo, mais uma folga para as vizinhas
                documento = new DocumentoRenderizado(caminhoArquivo, MaximoParalelismo + 2);
                _documentos[caminhoArquivo] = documento;
            }

            return documento;
        }
    }

    public void LiberarArquivo(string caminhoArquivo)
    {
        DocumentoRenderizado? documento;
        lock (_documentos)
        {
            if (!_documentos.Remove(caminhoArquivo, out documento))
                return;
        }

        documento.Dispose();
    }

    public void Dispose()
    {
        lock (_documentos)
        {
            foreach (var documento in _documentos.Values)
                documento.Dispose();
            _documentos.Clear();
        }

        while (_motoresLivres.TryTake(out var motor))
            motor.Dispose();
    }

    private sealed record PaginaRenderizada(byte[] Bytes, int Largura, int Altura);

    // O PDFium não é seguro para uso concorrente: a renderização de um mesmo documento é serializada,
    // enquanto o recorte e o reconhecimento das regiões seguem em paralelo.
    private sealed class DocumentoRenderizado : IDisposable
    {
        private readonly object _sync = new();
        private readonly IDocReader _leitor;
        private readonly int _limitePaginasEmCache;
        private readonly Dictionary<int, PaginaRenderizada> _paginas = new();
        private readonly Queue<int> _ordemRenderizacao = new();
        private bool _descartado;

        public DocumentoRenderizado(string caminhoArquivo, int limitePaginasEmCache)
        {
            _leitor = DocLib.Instance.GetDocReader(caminhoArquivo, new PageDimensions(3508, 3508));
            _limitePaginasEmCache = limitePaginasEmCache;
        }

        public PaginaRenderizada Renderizar(int numeroPagina)
        {
            lock (_sync)
            {
                if (_descartado)
                    throw new ObjectDisposedException(nameof(DocumentoRenderizado));

                if (_paginas.TryGetValue(numeroPagina, out var paginaEmCache))
                    return paginaEmCache;

                using var pageReader = _leitor.GetPageReader(numeroPagina - 1);
                var pagina = new PaginaRenderizada(pageReader.GetImage(), pageReader.GetPageWidth(), pageReader.GetPageHeight());

                _paginas[numeroPagina] = pagina;
                _ordemRenderizacao.Enqueue(numeroPagina);
                while (_ordemRenderizacao.Count > _limitePaginasEmCache)
                    _paginas.Remove(_ordemRenderizacao.Dequeue());

                return pagina;
            }
        }

        public void Dispose()
        {
            lock (_sync)
            {
                if (_descartado)
                    return;

                _descartado = true;
                _paginas.Clear();
                _ordemRenderizacao.Clear();
                _leitor.Dispose();
            }
        }
    }
}
