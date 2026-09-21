using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.DTOs.Processamento;
using SMARsvp.Application.Interfaces;

namespace SMARsvp.Application.Services;

public class AuditoriaValidacaoService : IAuditoriaValidacaoService
{
    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNameCaseInsensitive = true
    };

    public async Task<ResultadoAuditoriaDto> ProcessarAuditoriaSimuladaAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string nomeArquivo,
        bool utilizouOcr,
        string pastaTemp)
    {
        await MontarQueriesEBuscarBancoAsync(extracao, layout, pastaTemp);
        return await CompararEGerarAuditoriaAsync(extracao, layout, nomeArquivo, utilizouOcr, pastaTemp);
    }

    public async Task MontarQueriesEBuscarBancoAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string pastaTemp)
    {
        var queriesMontadas = new List<DocumentoQueriesDto>();

        if (extracao?.Documentos != null)
        {
            foreach (var doc in extracao.Documentos)
            {
                var docQueries = new DocumentoQueriesDto
                {
                    PaginaInicio = doc.PaginaInicio,
                    PaginaFim = doc.PaginaFim,
                    Queries = new List<QueryMontadaDto>()
                };

                if (layout?.QueriesValidacao != null && layout.QueriesValidacao.Any())
                {
                    foreach (var query in layout.QueriesValidacao)
                    {
                        var parametros = new Dictionary<string, string>();
                        string sqlRenderizado = query.Sql ?? string.Empty;

                        var matches = Regex.Matches(sqlRenderizado, @"\$\{([^}]+)\}|\$([a-zA-Z0-9_]+)");

                        foreach (Match match in matches)
                        {
                            string parametroSql = match.Value;
                            string nomeCampoBruto = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
                            string nomeCampo = nomeCampoBruto.Trim();

                            var campoExt = doc.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.Nome) &&
                                c.Nome.Trim().Equals(nomeCampo, StringComparison.OrdinalIgnoreCase));

                            string? valorBruto = campoExt?.ValorExtraido;
                            string valorSql = FormatarValorParaSql(valorBruto);

                            sqlRenderizado = sqlRenderizado.Replace(parametroSql, valorSql);
                            parametros[parametroSql] = valorBruto ?? "NULL";
                        }

                        docQueries.Queries.Add(new QueryMontadaDto
                        {
                            NomeQuery = query.Nome ?? "Query Sem Nome",
                            SqlOriginal = query.Sql ?? string.Empty,
                            SqlRenderizado = sqlRenderizado,
                            Parametros = parametros
                        });
                    }
                }

                queriesMontadas.Add(docQueries);
            }
        }

        Directory.CreateDirectory(pastaTemp);

        string caminhoQueriesMontadas = Path.Combine(pastaTemp, "queries_montadas.json");
        await File.WriteAllTextAsync(caminhoQueriesMontadas, JsonSerializer.Serialize(queriesMontadas, OpcoesJson));

        string caminhoBancoMock = Path.Combine(pastaTemp, "dados_banco.json");
        var dadosBanco = new List<RetornoBancoSimuladoDto>();

        if (File.Exists(caminhoBancoMock))
        {
            try
            {
                string bancoJson = await File.ReadAllTextAsync(caminhoBancoMock);
                dadosBanco = JsonSerializer.Deserialize<List<RetornoBancoSimuladoDto>>(bancoJson, OpcoesJson)
                             ?? new List<RetornoBancoSimuladoDto>();
            }
            catch
            {
                dadosBanco = new List<RetornoBancoSimuladoDto>();
            }
        }
        else
        {
            dadosBanco = queriesMontadas.Select(q => new RetornoBancoSimuladoDto
            {
                PaginaInicio = q.PaginaInicio,
                PaginaFim = q.PaginaFim,
                DadosRetornados = new Dictionary<string, string>()
            }).ToList();

            await File.WriteAllTextAsync(caminhoBancoMock, JsonSerializer.Serialize(dadosBanco, OpcoesJson));
        }
    }

    public async Task<ResultadoAuditoriaDto> CompararEGerarAuditoriaAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string nomeArquivo,
        bool utilizouOcr,
        string pastaTemp)
    {
        string caminhoBancoMock = Path.Combine(pastaTemp, "dados_banco.json");
        var dadosBanco = new List<RetornoBancoSimuladoDto>();

        if (File.Exists(caminhoBancoMock))
        {
            try
            {
                string bancoJson = await File.ReadAllTextAsync(caminhoBancoMock);
                dadosBanco = JsonSerializer.Deserialize<List<RetornoBancoSimuladoDto>>(bancoJson, OpcoesJson)
                             ?? new List<RetornoBancoSimuladoDto>();
            }
            catch
            {
                dadosBanco = new List<RetornoBancoSimuladoDto>();
            }
        }

        var resultadoAuditoria = new ResultadoAuditoriaDto
        {
            NomeArquivo = string.IsNullOrWhiteSpace(nomeArquivo) ? "arquivo_importado.pdf" : nomeArquivo,
            LayoutUtilizado = layout?.NomeModelo ?? "Layout Padrão",
            TotalDocumentosAnalisados = extracao?.DocumentosProcessados ?? 0,
            Amostragem = extracao?.PercentualAmostragem ?? 100,
            UsouOcr = utilizouOcr,
            Inconsistencias = new List<InconsistenciaItemDto>(),
            Validacoes = new List<ValidacaoDetalhadaDto>()
        };

        int documentosComErro = 0;

        if (extracao?.Documentos != null)
        {
            foreach (var doc in extracao.Documentos)
            {
                bool temErroNoDoc = false;

                // Localiza o documento correspondente no mock do banco
                var docBanco = dadosBanco.FirstOrDefault(d =>
                    d.PaginaInicio == doc.PaginaInicio && d.PaginaFim == doc.PaginaFim);

                if (docBanco == null)
                {
                    resultadoAuditoria.Inconsistencias.Add(new InconsistenciaItemDto
                    {
                        PaginaExtraido = doc.PaginaInicio,
                        Campo = "Geral",
                        ValorExtraidoPdf = "Encontrado",
                        ValorEsperadoBanco = "Ausente",
                        MensagemAuditoria = "Documento ausente no banco (mock)."
                    });
                    documentosComErro++;
                    continue;
                }

                if (layout?.QueriesValidacao != null && layout.QueriesValidacao.Any())
                {
                    foreach (var query in layout.QueriesValidacao)
                    {
                        if (query?.Regras == null) continue;

                        foreach (var regra in query.Regras)
                        {
                            if (string.IsNullOrWhiteSpace(regra.CampoCarne)) continue;

                            string nomeCampoRegra = regra.CampoCarne.Trim();

                            // 1. Identifica no layout em qual página relativa do carnê este campo está configurado
                            var campoConfigurado = layout.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.NomeCampo) &&
                                c.NomeCampo.Trim().Equals(nomeCampoRegra, StringComparison.OrdinalIgnoreCase));

                            // 2. Localiza o campo extraído no documento.
                            // Se soubermos a página configurada, filtramos preferencialmente por ela.
                            CampoExtraidoDto? campoExt = null;

                            if (campoConfigurado != null && campoConfigurado.Pagina > 0)
                            {
                                int paginaAbsolutaEsperada = doc.PaginaInicio + (campoConfigurado.Pagina - 1);
                                campoExt = doc.Campos?.FirstOrDefault(c =>
                                    !string.IsNullOrWhiteSpace(c?.Nome) &&
                                    c.Nome.Trim().Equals(nomeCampoRegra, StringComparison.OrdinalIgnoreCase) &&
                                    c.PaginaExtraido == paginaAbsolutaEsperada);
                            }

                            // Fallback caso não ache pela página absoluta exata: busca pelo nome do campo
                            campoExt ??= doc.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.Nome) &&
                                c.Nome.Trim().Equals(nomeCampoRegra, StringComparison.OrdinalIgnoreCase));

                            // 3. Determina a página real do campo para exibição
                            int paginaExata = campoExt?.PaginaExtraido > 0
                                ? campoExt.PaginaExtraido
                                : (campoConfigurado != null && campoConfigurado.Pagina > 0
                                    ? doc.PaginaInicio + (campoConfigurado.Pagina - 1)
                                    : doc.PaginaInicio);

                            string extraido = campoExt?.ValorExtraido?.Trim() ?? string.Empty;

                            // 4. Busca o valor esperado correspondente no mock do banco
                            string esperado = string.Empty;
                            if (docBanco.DadosRetornados != null && !string.IsNullOrWhiteSpace(regra.CampoRetornado))
                            {
                                var chaveBanco = docBanco.DadosRetornados.Keys.FirstOrDefault(k =>
                                    k.Trim().Equals(regra.CampoRetornado.Trim(), StringComparison.OrdinalIgnoreCase));

                                if (chaveBanco != null && docBanco.DadosRetornados.TryGetValue(chaveBanco, out var vBanco))
                                {
                                    esperado = vBanco?.Trim() ?? string.Empty;
                                }
                            }

                            bool iguais = string.Equals(extraido, esperado, StringComparison.OrdinalIgnoreCase);

                            resultadoAuditoria.Validacoes.Add(new ValidacaoDetalhadaDto
                            {
                                PaginaExtraido = paginaExata,
                                NomeQuery = query.Nome ?? string.Empty,
                                CampoLayout = regra.CampoCarne,
                                CampoBanco = regra.CampoRetornado,
                                RegraAplicada = regra.Operador ?? "=",
                                ValorExtraido = string.IsNullOrWhiteSpace(extraido) ? "Vazio/Null" : extraido,
                                ValorBanco = string.IsNullOrWhiteSpace(esperado) ? "Vazio/Null" : esperado,
                                Status = iguais ? "OK" : "DIVERGÊNCIA",
                                MensagemAuditoria = iguais ? "Valor validado com sucesso." : "Divergência de valores."
                            });

                            if (!iguais)
                            {
                                temErroNoDoc = true;
                                resultadoAuditoria.Inconsistencias.Add(new InconsistenciaItemDto
                                {
                                    PaginaExtraido = paginaExata,
                                    Campo = regra.CampoCarne,
                                    ValorExtraidoPdf = string.IsNullOrWhiteSpace(extraido) ? "Vazio/Null" : extraido,
                                    ValorEsperadoBanco = string.IsNullOrWhiteSpace(esperado) ? "Vazio/Null" : esperado,
                                    MensagemAuditoria = "Divergência de valores."
                                });
                            }
                        }
                    }
                }

                if (temErroNoDoc) documentosComErro++;
            }
        }

        resultadoAuditoria.DocumentosComInconsistencia = documentosComErro;
        resultadoAuditoria.DocumentosValidos = Math.Max(0, resultadoAuditoria.TotalDocumentosAnalisados - documentosComErro);

        Directory.CreateDirectory(pastaTemp);
        string caminhoAuditoria = Path.Combine(pastaTemp, "resultado_auditoria.json");
        await File.WriteAllTextAsync(caminhoAuditoria, JsonSerializer.Serialize(resultadoAuditoria, OpcoesJson));

        return resultadoAuditoria;
    }

    private static string FormatarValorParaSql(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return "NULL";
        if (decimal.TryParse(valor, out _)) return valor;
        return $"'{valor.Replace("'", "''")}'";
    }
}