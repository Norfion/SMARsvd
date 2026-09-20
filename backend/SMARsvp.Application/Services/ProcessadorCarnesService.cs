using System.Text.Encodings.Web;
using System.Text.Json;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.DTOs.Processamento;
using SMARsvp.Application.Interfaces;

namespace SMARsvp.Application.Services;

public class ProcessadorCarnesService
{
    private readonly IExtratorPdfService _extratorPdf;
    private readonly IOcrService _ocrService;

    public ProcessadorCarnesService(IExtratorPdfService extratorPdf, IOcrService ocrService)
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
        int contadorDocs = 1;

        for (int pagina = 1; pagina <= totalPaginas; pagina++)
        {
            var textoExt = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, pagina, regiaoId);

            Console.WriteLine($"[Página {pagina}] Identificador lido: '{textoExt}' | Esperado: '{regiaoId.TextoEsperadoIdentificador}'");

            bool ehInicio = textoExt?.Contains(regiaoId.TextoEsperadoIdentificador ?? "", StringComparison.OrdinalIgnoreCase) == true;

            if (ehInicio)
            {
                if (inicioDocAtual.HasValue)
                {
                    estrutura.Add(new DocumentoEstruturaDto
                    {
                        Documento = contadorDocs++,
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
                Documento = contadorDocs,
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
        await File.WriteAllTextAsync(
            caminhoEstruturaJson,
            JsonSerializer.Serialize(estrutura, opcoesJson)
        );

        Console.WriteLine($"[ProcessadorCarnes] Arquivo gerado com sucesso em: {caminhoEstruturaJson}");

        // 3. Aplicação da Amostragem
        int qtdAmostra = (int)Math.Ceiling(estrutura.Count * (amostragem / 100m));
        var documentosSelecionados = amostragem == 0
            ? new List<DocumentoEstruturaDto>()
            : estrutura.OrderBy(x => Guid.NewGuid()).Take(qtdAmostra).ToList(); // Sorteio aleatório

        var resultadoFinal = new ResultadoProcessamentoDto
        {
            PercentualAmostragem = amostragem,
            TotalDocumentos = estrutura.Count,
            DocumentosProcessados = documentosSelecionados.Count,
            Documentos = documentosSelecionados
        };

        // 4. Extração da amostra selecionada
        foreach (var doc in documentosSelecionados)
        {
            foreach (var campo in layout.Campos)
            {
                int paginaReal = doc.PaginaInicio + (campo.Pagina - 1);

                // Se a página do campo ultrapassar os limites do carnê
                if (paginaReal > doc.PaginaFim)
                {
                    doc.Campos.Add(new CampoExtraidoDto
                    {
                        Nome = campo.NomeCampo,
                        PaginaExtraido = campo.Pagina,
                        ExtracaoMetodo = "Erro: Página configurada excede o tamanho do documento."
                    });
                    continue;
                }

                try
                {
                    // TENTATIVA 1: Leitura do PDF Digital
                    var valorExtraido = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, paginaReal, campo);

                    if (!string.IsNullOrWhiteSpace(valorExtraido))
                    {
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            ValorExtraido = valorExtraido.Trim(),
                            PaginaExtraido = campo.Pagina,
                            ExtracaoMetodo = "Digital"
                        });
                    }
                    else
                    {
                        // TENTATIVA 2: OCR
                        var valorOcr = await _ocrService.ExtrairTextoPorOcrAsync(caminhoPdf, paginaReal, campo.XMm, campo.YMm, campo.LarguraMm, campo.AlturaMm);
                        doc.Campos.Add(new CampoExtraidoDto
                        {
                            Nome = campo.NomeCampo,
                            ValorExtraido = valorOcr,
                            PaginaExtraido = campo.Pagina,
                            ExtracaoMetodo = "OCR"
                        });
                    }
                }
                catch (Exception ex)
                {
                    doc.Campos.Add(new CampoExtraidoDto
                    {
                        Nome = campo.NomeCampo,
                        PaginaExtraido = campo.Pagina,
                        ExtracaoMetodo = $"Erro inesperado: {ex.Message}"
                    });
                }
            }
        }

        // 5. Salvar resultado final
        string caminhoResultadoJson = Path.Combine(pastaTemp, "resultado_extracao.json");
        await File.WriteAllTextAsync(
            caminhoResultadoJson,
            JsonSerializer.Serialize(resultadoFinal, opcoesJson)
        );
        Console.WriteLine($"[ProcessadorCarnes] Arquivo gerado com sucesso em: {caminhoResultadoJson}");

        return resultadoFinal;
    }
}