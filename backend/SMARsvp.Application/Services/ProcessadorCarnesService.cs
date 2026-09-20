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

        // 1. Identificação Incremental
        int? inicioDocAtual = null;
        int contadorDocs = 1;

        for (int pagina = 1; pagina <= totalPaginas; pagina++)
        {
            var textoExt = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, pagina, regiaoId);
            bool ehInicio = textoExt?.Contains(regiaoId.TextoEsperadoIdentificador ?? "", StringComparison.OrdinalIgnoreCase) == true;

            if (ehInicio)
            {
                if (inicioDocAtual.HasValue)
                {
                    estrutura.Add(new DocumentoEstruturaDto { Documento = contadorDocs++, Inicio = inicioDocAtual.Value, Fim = pagina - 1 });
                }
                inicioDocAtual = pagina;
            }
        }

        if (inicioDocAtual.HasValue)
        {
            estrutura.Add(new DocumentoEstruturaDto { Documento = contadorDocs, Inicio = inicioDocAtual.Value, Fim = totalPaginas });
        }

        // 2. Salvar estrutura temporária
        // Resolve o caminho subindo até a raiz onde fica a pasta database/ (igual ao controller e appsettings)
        string pastaTemp = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "database", "temp"));

        // Se a pasta não existir no caminho relativo acima, usa uma resolução segura a partir do diretório de trabalho atual
        if (!Directory.Exists(Path.GetDirectoryName(pastaTemp)))
        {
            pastaTemp = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database", "temp");
        }

        Directory.CreateDirectory(pastaTemp);

        string caminhoEstruturaJson = Path.Combine(pastaTemp, "documentos_estrutura.json");
        await File.WriteAllTextAsync(
            caminhoEstruturaJson,
            JsonSerializer.Serialize(estrutura, new JsonSerializerOptions { WriteIndented = true })
        );
        Console.WriteLine($"[ProcessadorCarnes] Arquivo gerado com sucesso em: {caminhoEstruturaJson}");

        // 3. Aplicação da Amostragem
        int qtdAmostra = (int)Math.Ceiling(estrutura.Count * (amostragem / 100m));
        var documentosSelecionados = amostragem == 0
            ? new List<DocumentoEstruturaDto>()
            : estrutura.OrderBy(x => Guid.NewGuid()).Take(qtdAmostra).ToList(); // Sorteio aleatório

        var resultadoFinal = new ResultadoProcessamentoDto
        {
            Amostragem = amostragem,
            TotalDocumentos = estrutura.Count,
            DocumentosProcessados = documentosSelecionados.Count,
            Documentos = documentosSelecionados
        };

        // 4. Extração apenas da amostra selecionada
        foreach (var doc in documentosSelecionados)
        {
            foreach (var campo in layout.Campos.Where(c => !c.EhIdentificadorPrimeiraPagina))
            {
                int paginaReal = doc.Inicio + (campo.Pagina - 1);

                if (paginaReal > doc.Fim)
                {
                    doc.Campos.Add(new CampoExtraidoDto { Nome = campo.NomeCampo, Status = "Erro: Região excede limites do documento." });
                    continue;
                }

                try
                {
                    var valor = await _extratorPdf.ExtrairTextoDigitalRegiaoAsync(caminhoPdf, paginaReal, campo);
                    if (!string.IsNullOrWhiteSpace(valor))
                    {
                        doc.Campos.Add(new CampoExtraidoDto { Nome = campo.NomeCampo, Valor = valor.Trim(), Status = "Digital" });
                    }
                    else
                    {
                        var valorOcr = await _ocrService.ExtrairTextoPorOcrAsync(caminhoPdf, paginaReal, campo.XMm, campo.YMm, campo.LarguraMm, campo.AlturaMm);
                        doc.Campos.Add(new CampoExtraidoDto { Nome = campo.NomeCampo, Valor = valorOcr, Status = "Aviso: OCR pendente/acionado" });
                    }
                }
                catch (Exception ex)
                {
                    doc.Campos.Add(new CampoExtraidoDto { Nome = campo.NomeCampo, Status = $"Erro inesperado: {ex.Message}" });
                }
            }
        }

        // 5. Salvar resultado final
        string caminhoResultadoJson = Path.Combine(pastaTemp, "resultado_extracao.json");
        await File.WriteAllTextAsync(
            caminhoResultadoJson,
            JsonSerializer.Serialize(resultadoFinal, new JsonSerializerOptions { WriteIndented = true })
        );
        Console.WriteLine($"[ProcessadorCarnes] Arquivo gerado com sucesso em: {caminhoResultadoJson}");

        return resultadoFinal;
    }
}