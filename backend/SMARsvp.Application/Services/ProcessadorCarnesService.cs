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
        var regiaoId = layout.Campos.FirstOrDefault(c => c.EhIdentificadorInicio);
        if (regiaoId == null)
            throw new Exception("O layout não possui um campo configurado como 'Identificador de início de carnê'.");

        int totalPaginas = await _extratorPdf.ObterTotalPaginasAsync(caminhoPdf);
        var estrutura = new List<DocumentoEstruturaDto>();

        // 1. Identificação Incremental dos Documentos
        int? inicioDocAtual = null;
        string textoEsperadoNormalizado = NormalizarTextoParaComparacao(regiaoId.TextoEsperadoInicio ?? string.Empty);

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

            Console.WriteLine($"[Página {pagina}] Identificador Início ({metodoUtilizado}): '{textoExt}' | Esperado: '{regiaoId.TextoEsperadoInicio}' | Detectado: {ehInicio}");

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
        var marcadoresEstrutura = layout.Campos.Where(c => c.EhIdentificadorPagina).ToList();
        bool usaClassificacaoDinamica = marcadoresEstrutura.Any();

        // 4. Mapeamento e Extração da amostra selecionada
        foreach (var doc in documentosExtracao)
        {
            var classificacaoPaginas = new Dictionary<int, string>();

            // 4.1 Classificação das páginas do documento
            if (usaClassificacaoDinamica)
            {
                for (int p = doc.PaginaInicio; p <= doc.PaginaFim; p++)
                {
                    string? estruturaEncontrada = null;
                    foreach (var marcador in marcadoresEstrutura)
                    {
                        var textoExt = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, p, marcador);
                        if (string.IsNullOrWhiteSpace(textoExt))
                        {
                            textoExt = await _ocrService.ExtrairTextoPorOcrAsync(caminhoPdf, p, marcador.XMm, marcador.YMm, marcador.LarguraMm, marcador.AlturaMm);
                        }

                        string textoLidoNormalizado = NormalizarTextoParaComparacao(textoExt ?? "");
                        string textoEsperado = NormalizarTextoParaComparacao(marcador.TextoEsperadoPagina ?? "");

                        if (!string.IsNullOrWhiteSpace(textoEsperado) && textoLidoNormalizado.Contains(textoEsperado, StringComparison.OrdinalIgnoreCase))
                        {
                            estruturaEncontrada = marcador.IdentificadorPagina;
                            break;
                        }
                    }

                    if (estruturaEncontrada != null)
                    {
                        classificacaoPaginas[p] = estruturaEncontrada;
                        Console.WriteLine($"[Processador] Página Real {p} classificada como estrutura '{estruturaEncontrada}'.");
                    }
                }
            }

            // 4.2 Iteração dos campos para extração nos locais exatos
            foreach (var campo in layout.Campos)
            {
                List<int> paginasAlvo = new List<int>();

                if (usaClassificacaoDinamica)
                {
                    // Obtém apenas as páginas que foram classificadas com o identificador do campo
                    paginasAlvo = classificacaoPaginas
                        .Where(kv => string.Equals(kv.Value, campo.IdentificadorPagina, StringComparison.OrdinalIgnoreCase))
                        .Select(kv => kv.Key)
                        .ToList();

                    if (!paginasAlvo.Any())
                    {
                        // Não encontrada a estrutura no documento, registra erro explicativo para evitar falso-ausente por página avulsa
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            PaginaExtraido = 0,
                            ExtracaoMetodo = $"Estrutura '{campo.IdentificadorPagina}' não localizada no documento."
                        });
                        continue;
                    }
                }
                else
                {
                    // Fallback de compatibilidade (Legado): Não há marcadores dinâmicos, extrai pela página relativa.
                    int paginaReal = doc.PaginaInicio + (campo.Pagina - 1);
                    if (paginaReal <= doc.PaginaFim)
                    {
                        paginasAlvo.Add(paginaReal);
                    }
                    else
                    {
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            PaginaExtraido = paginaReal,
                            ExtracaoMetodo = "Erro: Página configurada excede o tamanho do documento."
                        });
                        continue;
                    }
                }

                // Efetua a leitura de todas as páginas identificadas
                foreach (var paginaReal in paginasAlvo)
                {
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

                            if (!string.IsNullOrWhiteSpace(valorOcr))
                            {
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
                            else
                            {
                                doc.Campos.Add(new CampoExtraidoDto
                                {
                                    Nome = campo.NomeCampo,
                                    ValorExtraido = string.Empty,
                                    PaginaExtraido = paginaReal,
                                    ExtracaoMetodo = "Não encontrado"
                                });
                            }
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
            }
            catch { }
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