using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.DTOs.Processamento;
using SMARsvp.Application.Interfaces;

namespace SMARsvp.Application.Services;

public class ProcessadorCarnesService
{
    private readonly IExtratorPdfService _extratorPdf;
    private readonly IOcrService _ocrService;

    public ProcessadorCarnesService(
        IExtratorPdfService extratorPdf,
        IOcrService ocrService)
    {
        _extratorPdf = extratorPdf;
        _ocrService = ocrService;
    }

    public async Task<ResultadoProcessamentoDto> ProcessarLoteAsync(string caminhoPdf, LayoutClienteDto layout, decimal amostragem)
    {
        var regiaoId = layout.Campos.FirstOrDefault(c => c.EhIdentificadorPrimeiraPagina);
        if (regiaoId == null)
            throw new Exception("O layout não possui um campo configurado como 'Identificador de página'.");

        int totalPaginas = await _extratorPdf.ObterTotalPaginasAsync(caminhoPdf);
        var estrutura = new List<DocumentoEstruturaDto>();

        // 1. Identificação Incremental dos Documentos
        int? inicioDocAtual = null;
        string textoEsperadoNormalizado = NormalizarTextoParaComparacao(regiaoId.TextoEsperadoIdentificador ?? string.Empty);

        for (int pagina = 1; pagina <= totalPaginas; pagina++)
        {
            var textoExt = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, pagina, regiaoId);
            string metodoUtilizado = "Digital";

            if (string.IsNullOrWhiteSpace(textoExt))
            {
                textoExt = await _ocrService.ExtrairTextoPorOcrAsync(
                    caminhoPdf,
                    pagina,
                    regiaoId.XMm,
                    regiaoId.YMm,
                    regiaoId.LarguraMm,
                    regiaoId.AlturaMm);
                metodoUtilizado = "OCR";
            }

            string textoLidoNormalizado = NormalizarTextoParaComparacao(textoExt ?? string.Empty);
            bool ehInicio = !string.IsNullOrWhiteSpace(textoEsperadoNormalizado) &&
                           textoLidoNormalizado.Contains(textoEsperadoNormalizado, StringComparison.OrdinalIgnoreCase);

            Console.WriteLine($"[Página {pagina}] Identificador ({metodoUtilizado}): '{textoExt}' | Esperado: '{regiaoId.TextoEsperadoIdentificador}' | Início detectado: {ehInicio}");

            if (ehInicio)
            {
                if (inicioDocAtual.HasValue)
                {
                    estrutura.Add(new DocumentoEstruturaDto
                    {
                        PaginaInicio = inicioDocAtual.Value,
                        PaginaFim = pagina - 1
                    });
                }
                inicioDocAtual = pagina;
            }
        }

        if (inicioDocAtual.HasValue)
        {
            estrutura.Add(new DocumentoEstruturaDto
            {
                PaginaInicio = inicioDocAtual.Value,
                PaginaFim = totalPaginas
            });
        }

        // 2. Salvar estrutura temporária
        string pastaTemp = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "database", "temp"));
        if (!Directory.Exists(Path.GetDirectoryName(pastaTemp)))
        {
            pastaTemp = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database", "temp");
        }
        Directory.CreateDirectory(pastaTemp);

        var opcoesJson = new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        string caminhoEstruturaJson = Path.Combine(pastaTemp, "documentos_estrutura.json");
        await File.WriteAllTextAsync(caminhoEstruturaJson, JsonSerializer.Serialize(estrutura, opcoesJson));

        // 3. Aplicação da Amostragem
        int qtdAmostra = (int)Math.Ceiling(estrutura.Count * (amostragem / 100m));
        var documentosSorteados = amostragem == 0
            ? new List<DocumentoEstruturaDto>()
            : estrutura.OrderBy(x => Guid.NewGuid()).Take(qtdAmostra).ToList();

        var documentosExtracao = documentosSorteados.Select(doc => new DocumentoExtracaoDto
        {
            PaginaInicio = doc.PaginaInicio,
            PaginaFim = doc.PaginaFim
        }).ToList();

        bool utilizouOcr = false;

        // 4. Extração da amostra selecionada
        foreach (var doc in documentosExtracao)
        {
            foreach (var campo in layout.Campos)
            {
                int paginaReal = doc.PaginaInicio + (campo.Pagina - 1);

                if (paginaReal > doc.PaginaFim)
                {
                    doc.Campos.Add(new CampoExtraidoDto
                    {
                        Nome = campo.NomeCampo,
                        PaginaExtraido = paginaReal,
                        ExtracaoMetodo = "Erro: Página configurada excede o tamanho do documento."
                    });
                    continue;
                }

                try
                {
                    var valorExtraido = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, paginaReal, campo);

                    if (!string.IsNullOrWhiteSpace(valorExtraido))
                    {
                        valorExtraido = AplicarIdentificadorAnterior(valorExtraido, campo.IdentificadorAnterior, campo.NomeCampo, campo.TipoDado);
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            ValorExtraido = valorExtraido,
                            PaginaExtraido = paginaReal,
                            ExtracaoMetodo = "Digital"
                        });
                    }
                    else
                    {
                        var valorOcr = await _ocrService.ExtrairTextoPorOcrAsync(
                            caminhoPdf,
                            paginaReal,
                            campo.XMm,
                            campo.YMm,
                            campo.LarguraMm,
                            campo.AlturaMm);

                        valorOcr = AplicarIdentificadorAnterior(valorOcr, campo.IdentificadorAnterior, campo.NomeCampo, campo.TipoDado);
                        utilizouOcr = true;

                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            ValorExtraido = valorOcr,
                            PaginaExtraido = paginaReal,
                            ExtracaoMetodo = "OCR"
                        });
                    }
                }
                catch (Exception ex)
                {
                    doc.Campos.Add(new CampoExtraidoDto
                    {
                        Nome = campo.NomeCampo,
                        PaginaExtraido = paginaReal,
                        ExtracaoMetodo = $"Erro inesperado: {ex.Message}"
                    });
                }
            }
        }

        var resultadoFinal = new ResultadoProcessamentoDto
        {
            PercentualAmostragem = amostragem,
            TotalDocumentos = estrutura.Count,
            DocumentosProcessados = documentosExtracao.Count,
            UsouOcr = utilizouOcr,
            Documentos = documentosExtracao
        };

        // 5. Salvar resultado final em dados_extraidos.json
        string caminhoResultadoJson = Path.Combine(pastaTemp, "dados_extraidos.json");
        await File.WriteAllTextAsync(
            caminhoResultadoJson,
            JsonSerializer.Serialize(resultadoFinal, opcoesJson)
        );

        Console.WriteLine($"[ProcessadorCarnes] Arquivo de resultado gerado: {caminhoResultadoJson}");

        // 6. Limpeza do arquivo temporário documentos_estrutura.json
        if (File.Exists(caminhoEstruturaJson))
        {
            try
            {
                File.Delete(caminhoEstruturaJson);
                Console.WriteLine($"[ProcessadorCarnes] Arquivo temporário removido com sucesso: {caminhoEstruturaJson}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ProcessadorCarnes] Aviso: Não foi possível apagar {caminhoEstruturaJson}: {ex.Message}");
            }
        }

        return resultadoFinal;
    }

    private static string NormalizarTextoParaComparacao(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return string.Empty;

        string limpo = Regex.Replace(texto, @"\s+", " ").Trim();
        var normalizado = limpo.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();

        foreach (var c in normalizado)
        {
            var categoria = CharUnicodeInfo.GetUnicodeCategory(c);
            if (categoria != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }

        return sb.ToString().Normalize(NormalizationForm.FormC).Trim();
    }

    private static string AplicarIdentificadorAnterior(string texto, string? identificadorAnterior, string nomeCampo, string? tipoDado)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return string.Empty;

        if (!string.IsNullOrWhiteSpace(identificadorAnterior))
        {
            string identificador = identificadorAnterior.Trim();
            int indice = texto.IndexOf(identificador, StringComparison.OrdinalIgnoreCase);

            if (indice >= 0)
            {
                texto = texto.Substring(indice + identificador.Length).Trim();
            }
            else
            {
                string padraoEscapado = Regex.Escape(identificador)
                    .Replace(@"\:", @"\s*\:\s*")
                    .Replace(@"\-", @"\s*\-\s*");

                var match = Regex.Match(texto, padraoEscapado, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    texto = texto.Substring(match.Index + match.Length).Trim();
                }
            }
        }

        texto = texto.TrimStart(':', '-', ' ', '.', ',', '|').Trim();

        bool ehCampoNumerico = (!string.IsNullOrWhiteSpace(tipoDado) && tipoDado.Equals("Numerico", StringComparison.OrdinalIgnoreCase)) ||
                               Regex.IsMatch(nomeCampo, @"(?i)(CRC|Lote|Nro|Número|Parcela|Valor|Data|CEP|CPF|CNPJ)");

        if (ehCampoNumerico && !string.IsNullOrWhiteSpace(texto))
        {
            var matchNumero = Regex.Match(texto, @"\d");

            if (matchNumero.Success && matchNumero.Index > 0 && matchNumero.Index <= 6)
            {
                texto = texto.Substring(matchNumero.Index).Trim();
            }

            texto = Regex.Replace(texto, @"^[^\d]+|[^\d\.\,\-\/]+$", "").Trim();
        }

        return texto;
    }
}