using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.DTOs.Processamento;
using SMARsvp.Application.Interfaces;
using SMARsvp.Domain.Enums;

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
        // 1. Localiza a região do Identificador de Documento
        var regiaoIdDocumento = layout.Campos.FirstOrDefault(c => c.TipoClassificacao == TipoClassificacaoCampo.IdentificadorDocumento);
        if (regiaoIdDocumento == null)
            throw new Exception("O layout não possui um campo configurado como 'Identificador de documento'.");

        int totalPaginas = await _extratorPdf.ObterTotalPaginasAsync(caminhoPdf);
        var estrutura = new List<DocumentoEstruturaDto>();

        // 2. Identificação e Delimitação dos Documentos no Lote
        int? inicioDocAtual = null;
        string textoEsperadoDocNormalizado = NormalizarTextoParaComparacao(regiaoIdDocumento.TextoEsperadoDocumento ?? string.Empty);

        for (int pagina = 1; pagina <= totalPaginas; pagina++)
        {
            var textoExt = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, pagina, regiaoIdDocumento);
            string metodoUtilizado = "Digital";

            if (string.IsNullOrWhiteSpace(textoExt))
            {
                textoExt = await _ocrService.ExtrairTextoPorOcrAsync(
                    caminhoPdf,
                    pagina,
                    regiaoIdDocumento.XMm,
                    regiaoIdDocumento.YMm,
                    regiaoIdDocumento.LarguraMm,
                    regiaoIdDocumento.AlturaMm);
                metodoUtilizado = "OCR";
            }

            string textoLidoNormalizado = NormalizarTextoParaComparacao(textoExt ?? string.Empty);
            bool ehInicio = !string.IsNullOrWhiteSpace(textoEsperadoDocNormalizado) &&
                           textoLidoNormalizado.Contains(textoEsperadoDocNormalizado, StringComparison.OrdinalIgnoreCase);

            Console.WriteLine($"[Página {pagina}] Identificador de Documento ({metodoUtilizado}): '{textoExt}' | Esperado: '{regiaoIdDocumento.TextoEsperadoDocumento}' | Detectado: {ehInicio}");

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

        // 3. Salvar estrutura temporária
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

        // 4. Amostragem
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

        // Marcadores de estrutura da página (Identificadores de Página)
        var marcadoresPagina = layout.Campos
            .Where(c => c.TipoClassificacao == TipoClassificacaoCampo.IdentificadorPagina)
            .ToList();
        bool usaClassificacaoDinamica = marcadoresPagina.Any();

        // Campos de dados normais (que serão validados)
        var camposNormais = layout.Campos
            .Where(c => c.TipoClassificacao == TipoClassificacaoCampo.Nenhum)
            .ToList();

        // 5. Mapeamento Estrutural e Extração
        foreach (var doc in documentosExtracao)
        {
            var classificacaoPaginas = new Dictionary<int, List<string>>();

            // 5.1 Classificação das páginas do documento corrente
            if (usaClassificacaoDinamica)
            {
                for (int p = doc.PaginaInicio; p <= doc.PaginaFim; p++)
                {
                    classificacaoPaginas[p] = new List<string>();

                    foreach (var marcador in marcadoresPagina)
                    {
                        var textoExt = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, p, marcador);
                        if (string.IsNullOrWhiteSpace(textoExt))
                        {
                            textoExt = await _ocrService.ExtrairTextoPorOcrAsync(
                                caminhoPdf,
                                p,
                                marcador.XMm,
                                marcador.YMm,
                                marcador.LarguraMm,
                                marcador.AlturaMm);
                        }

                        string textoLidoNormalizado = NormalizarTextoParaComparacao(textoExt ?? string.Empty);
                        string textoEsperado = NormalizarTextoParaComparacao(marcador.TextoEsperadoPagina ?? string.Empty);

                        if (!string.IsNullOrWhiteSpace(textoEsperado) && textoLidoNormalizado.Contains(textoEsperado, StringComparison.OrdinalIgnoreCase))
                        {
                            classificacaoPaginas[p].Add(marcador.NomeCampo.Trim());
                            Console.WriteLine($"[Processador] Documento ({doc.PaginaInicio}-{doc.PaginaFim}) - Página {p} classificada como '{marcador.NomeCampo}'.");
                        }
                    }
                }
            }

            // 5.2 Extração exclusiva dos campos normais
            foreach (var campo in camposNormais)
            {
                List<int> paginasAlvo = new List<int>();

                if (usaClassificacaoDinamica)
                {
                    // Localiza todas as páginas físicas deste documento que possuem o identificador do campo
                    paginasAlvo = classificacaoPaginas
                        .Where(kv => kv.Value.Any(nomeId => string.Equals(nomeId, campo.IdentificadorPagina?.Trim(), StringComparison.OrdinalIgnoreCase)))
                        .Select(kv => kv.Key)
                        .ToList();

                    if (!paginasAlvo.Any())
                    {
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            PaginaExtraido = 0,
                            ExtracaoMetodo = $"Identificador de página '{campo.IdentificadorPagina}' não localizado no documento."
                        });
                        continue;
                    }
                }
                else
                {
                    // Fallback legado caso o layout não possua nenhum identificador de página configurado
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

                // Extração em todas as páginas identificadas para o campo
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

        // Ordena os campos de cada documento em ordem crescente de página física e nome
        foreach (var doc in documentosExtracao)
        {
            doc.Campos = doc.Campos
                .OrderBy(c => c.PaginaExtraido)
                .ThenBy(c => c.Nome)
                .ToList();
        }

        // Ordena a lista de documentos em ordem crescente de início da página
        var documentosOrdenados = documentosExtracao
            .OrderBy(d => d.PaginaInicio)
            .ToList();

        var resultadoFinal = new ResultadoProcessamentoDto
        {
            PercentualAmostragem = amostragem,
            TotalDocumentos = estrutura.Count,
            DocumentosProcessados = documentosOrdenados.Count,
            UsouOcr = utilizouOcr,
            Documentos = documentosOrdenados
        };

        // 6. Salvar dados_extraidos.json
        string caminhoResultadoJson = Path.Combine(pastaTemp, "dados_extraidos.json");
        await File.WriteAllTextAsync(
            caminhoResultadoJson,
            JsonSerializer.Serialize(resultadoFinal, opcoesJson)
        );

        Console.WriteLine($"[ProcessadorCarnes] Arquivo de resultado gerado: {caminhoResultadoJson}");

        // 7. Limpeza do temporário
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