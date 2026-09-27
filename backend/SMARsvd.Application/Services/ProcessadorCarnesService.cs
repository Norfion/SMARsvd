using System.Globalization;
using System.Runtime.ExceptionServices;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;
using SMARsvd.Domain.Enums;

namespace SMARsvd.Application.Services;

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

    public async Task<ResultadoProcessamentoDto> ProcessarLoteAsync(string caminhoPdf, LayoutClienteDto layout, decimal amostragem, string pastaTemp)
    {
        try
        {
            return await ProcessarLoteInternoAsync(caminhoPdf, layout, amostragem, pastaTemp);
        }
        finally
        {
            _extratorPdf.LiberarArquivo(caminhoPdf);
            _ocrService.LiberarArquivo(caminhoPdf);
        }
    }

    private async Task<ResultadoProcessamentoDto> ProcessarLoteInternoAsync(string caminhoPdf, LayoutClienteDto layout, decimal amostragem, string pastaTemp)
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

        var leiturasIdentificador = Enumerable.Range(1, totalPaginas)
            .Select(pagina => new LeituraRegiao(pagina, regiaoIdDocumento))
            .ToList();
        await LerRegioesAsync(caminhoPdf, leiturasIdentificador);
        LancarPrimeiroErro(leiturasIdentificador);

        foreach (var leitura in leiturasIdentificador)
        {
            int pagina = leitura.Pagina;
            string? textoExt = leitura.Texto;
            string metodoUtilizado = leitura.TentouOcr ? "OCR" : "Digital";

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
        // 5.1 Classificação das páginas dos documentos sorteados. Como os documentos não se sobrepõem,
        // a classificação é indexada apenas pela página física.
        var classificacaoPaginas = new Dictionary<int, List<string>>();

        if (usaClassificacaoDinamica)
        {
            var leiturasMarcadores = new List<(DocumentoExtracaoDto Doc, LeituraRegiao Leitura)>();
            foreach (var doc in documentosExtracao)
            {
                for (int p = doc.PaginaInicio; p <= doc.PaginaFim; p++)
                {
                    classificacaoPaginas[p] = new List<string>();

                    foreach (var marcador in marcadoresPagina)
                        leiturasMarcadores.Add((doc, new LeituraRegiao(p, marcador)));
                }
            }

            var leituras = leiturasMarcadores.Select(l => l.Leitura).ToList();
            await LerRegioesAsync(caminhoPdf, leituras);
            LancarPrimeiroErro(leituras);

            foreach (var (doc, leitura) in leiturasMarcadores)
            {
                var marcador = leitura.Regiao;
                string textoLidoNormalizado = NormalizarTextoParaComparacao(leitura.Texto ?? string.Empty);
                string textoEsperado = NormalizarTextoParaComparacao(marcador.TextoEsperadoPagina ?? string.Empty);

                if (!string.IsNullOrWhiteSpace(textoEsperado) && textoLidoNormalizado.Contains(textoEsperado, StringComparison.OrdinalIgnoreCase))
                {
                    classificacaoPaginas[leitura.Pagina].Add(marcador.NomeCampo.Trim());
                    Console.WriteLine($"[Processador] Documento ({doc.PaginaInicio}-{doc.PaginaFim}) - Página {leitura.Pagina} classificada como '{marcador.NomeCampo}'.");
                }
            }
        }

        // 5.2 Extração exclusiva dos campos normais
        var leiturasCampos = new List<(DocumentoExtracaoDto Doc, LeituraRegiao Leitura)>();

        foreach (var doc in documentosExtracao)
        {
            foreach (var campo in camposNormais)
            {
                List<int> paginasAlvo = new List<int>();

                if (usaClassificacaoDinamica)
                {
                    // Localiza todas as páginas físicas deste documento que possuem o identificador do campo
                    paginasAlvo = Enumerable.Range(doc.PaginaInicio, doc.PaginaFim - doc.PaginaInicio + 1)
                        .Where(p => classificacaoPaginas.TryGetValue(p, out var identificadores)
                                    && identificadores.Any(nomeId => string.Equals(nomeId, campo.IdentificadorPagina?.Trim(), StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                    if (!paginasAlvo.Any())
                    {
                        string motivo = $"Identificador de página '{campo.IdentificadorPagina}' não localizado no documento.";
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            PaginaExtraido = 0,
                            ExtracaoMetodo = motivo,
                            Situacao = SituacaoValorCampo.Ausente,
                            MensagemValidacao = motivo
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
                        const string motivo = "Erro: Página configurada excede o tamanho do documento.";
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            PaginaExtraido = paginaReal,
                            ExtracaoMetodo = motivo,
                            Situacao = SituacaoValorCampo.Ausente,
                            MensagemValidacao = motivo
                        });
                        continue;
                    }
                }

                // Extração em todas as páginas identificadas para o campo
                foreach (var paginaReal in paginasAlvo)
                    leiturasCampos.Add((doc, new LeituraRegiao(paginaReal, campo)));
            }
        }

        await LerRegioesAsync(caminhoPdf, leiturasCampos.Select(l => l.Leitura).ToList());

        foreach (var (doc, leitura) in leiturasCampos)
        {
            var campo = leitura.Regiao;
            int paginaReal = leitura.Pagina;

            try
            {
                if (leitura.Erro != null)
                    ExceptionDispatchInfo.Capture(leitura.Erro).Throw();

                string? textoRegiao = leitura.Texto;

                if (string.IsNullOrWhiteSpace(textoRegiao))
                {
                    doc.Campos.Add(new CampoExtraidoDto
                    {
                        Nome = campo.NomeCampo,
                        ValorExtraido = string.Empty,
                        PaginaExtraido = paginaReal,
                        ExtracaoMetodo = "Não encontrado",
                        Situacao = SituacaoValorCampo.Ausente,
                        MensagemValidacao = "Nenhum texto encontrado na região."
                    });
                    continue;
                }

                string metodo = leitura.TentouOcr ? "OCR" : "Digital";
                if (leitura.TentouOcr)
                    utilizouOcr = true;

                var interpretacao = InterpretadorValorCampo.Interpretar(textoRegiao, campo);
                bool valorInterpretado = interpretacao.Situacao == SituacaoValorCampo.Ok;

                doc.Campos.Add(new CampoExtraidoDto
                {
                    Nome = campo.NomeCampo,
                    ValorExtraido = interpretacao.Valor,
                    PaginaExtraido = paginaReal,
                    ExtracaoMetodo = metodo,
                    Situacao = interpretacao.Situacao,
                    MensagemValidacao = interpretacao.Motivo,
                    TextoRegiao = valorInterpretado ? null : textoRegiao.Trim()
                });
            }
            catch (Exception ex)
            {
                doc.Campos.Add(new CampoExtraidoDto
                {
                    Nome = campo.NomeCampo,
                    PaginaExtraido = paginaReal,
                    ExtracaoMetodo = $"Erro inesperado: {ex.Message}",
                    Situacao = SituacaoValorCampo.Invalido,
                    MensagemValidacao = $"Erro inesperado na extração: {ex.Message}"
                });
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

    private sealed class LeituraRegiao
    {
        public LeituraRegiao(int pagina, RegiaoCampoDto regiao)
        {
            Pagina = pagina;
            Regiao = regiao;
        }

        public int Pagina { get; }
        public RegiaoCampoDto Regiao { get; }
        public string? Texto { get; set; }
        public bool TentouOcr { get; set; }
        public Exception? Erro { get; set; }
    }

    // O texto digital é lido em sequência, pois o extrator mantém o PDF e a última página em cache e não é
    // seguro para uso concorrente. Só as regiões sem texto digital seguem para o OCR, que roda em paralelo.
    // A ordenação por página mantém as leituras vizinhas próximas, aproveitando os caches de página.
    private async Task LerRegioesAsync(string caminhoPdf, IReadOnlyList<LeituraRegiao> leituras)
    {
        foreach (var leitura in leituras.OrderBy(l => l.Pagina))
        {
            try
            {
                leitura.Texto = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, leitura.Pagina, leitura.Regiao);
            }
            catch (Exception ex)
            {
                leitura.Erro = ex;
            }
        }

        var pendentesOcr = leituras
            .Where(l => l.Erro == null && string.IsNullOrWhiteSpace(l.Texto))
            .OrderBy(l => l.Pagina)
            .ToList();

        if (pendentesOcr.Count == 0)
            return;

        var opcoes = new ParallelOptions { MaxDegreeOfParallelism = Math.Max(1, _ocrService.MaximoParalelismo) };
        await Parallel.ForEachAsync(pendentesOcr, opcoes, async (leitura, _) =>
        {
            leitura.TentouOcr = true;
            try
            {
                leitura.Texto = await _ocrService.ExtrairTextoPorOcrAsync(
                    caminhoPdf,
                    leitura.Pagina,
                    leitura.Regiao.XMm,
                    leitura.Regiao.YMm,
                    leitura.Regiao.LarguraMm,
                    leitura.Regiao.AlturaMm);
            }
            catch (Exception ex)
            {
                leitura.Erro = ex;
            }
        });
    }

    private static void LancarPrimeiroErro(IEnumerable<LeituraRegiao> leituras)
    {
        var erro = leituras.FirstOrDefault(l => l.Erro != null)?.Erro;
        if (erro != null)
            ExceptionDispatchInfo.Capture(erro).Throw();
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
}