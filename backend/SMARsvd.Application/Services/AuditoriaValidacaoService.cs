using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Application.Services;

public class AuditoriaValidacaoService : IAuditoriaValidacaoService
{
    private readonly IBancoDadosExecutorFactory _bancoFactory;

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNameCaseInsensitive = true
    };

    public AuditoriaValidacaoService(IBancoDadosExecutorFactory bancoFactory)
    {
        _bancoFactory = bancoFactory;
    }

    public async Task<ResultadoAuditoriaDto> ProcessarAuditoriaSimuladaAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string nomeArquivo,
        bool utilizouOcr,
        string pastaTemp,
        ConfiguracaoBancoDto? conexaoBanco = null)
    {
        await MontarQueriesEBuscarBancoAsync(extracao, layout, pastaTemp, conexaoBanco);
        return await CompararEGerarAuditoriaAsync(extracao, layout, nomeArquivo, utilizouOcr, pastaTemp);
    }

    public async Task MontarQueriesEBuscarBancoAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string pastaTemp,
        ConfiguracaoBancoDto? conexaoBanco = null)
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

        // 1. Salva queries_montadas.json
        string caminhoQueriesMontadas = Path.Combine(pastaTemp, "queries_montadas.json");
        await File.WriteAllTextAsync(caminhoQueriesMontadas, JsonSerializer.Serialize(queriesMontadas, OpcoesJson));

        // 2. Se houver configuração de conexão, executa no banco real
        if (conexaoBanco != null && !string.IsNullOrWhiteSpace(conexaoBanco.Servidor))
        {
            var executor = _bancoFactory.ObterExecutor(conexaoBanco.Provedor);
            var retornosQueries = await executor.ExecutarLoteQueriesAsync(queriesMontadas, conexaoBanco);

            // 3. Salva queries_retornos.json
            string caminhoQueriesRetornos = Path.Combine(pastaTemp, "queries_retornos.json");
            await File.WriteAllTextAsync(caminhoQueriesRetornos, JsonSerializer.Serialize(retornosQueries, OpcoesJson));

            // Exclui queries_montadas.json logo após a gravação de queries_retornos.json
            if (File.Exists(caminhoQueriesMontadas))
            {
                File.Delete(caminhoQueriesMontadas);
            }

            // 4. Converte os retornos das queries para o dados_banco.json
            var dadosBanco = new List<RetornoBancoSimuladoDto>();

            foreach (var docRetorno in retornosQueries)
            {
                var mapaDados = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                foreach (var item in docRetorno.Retornos)
                {
                    if (item.Sucesso && item.Registros.Any())
                    {
                        var primeiraLinha = item.Registros.First();
                        foreach (var kvp in primeiraLinha)
                        {
                            if (!mapaDados.ContainsKey(kvp.Key))
                            {
                                mapaDados[kvp.Key] = kvp.Value;
                            }
                        }
                    }
                }

                dadosBanco.Add(new RetornoBancoSimuladoDto
                {
                    PaginaInicio = docRetorno.PaginaInicio,
                    PaginaFim = docRetorno.PaginaFim,
                    DadosRetornados = mapaDados
                });
            }

            string caminhoDadosBanco = Path.Combine(pastaTemp, "dados_banco.json");
            await File.WriteAllTextAsync(caminhoDadosBanco, JsonSerializer.Serialize(dadosBanco, OpcoesJson));
        }
        else
        {
            // Fallback caso não seja informada conexão
            string caminhoBancoMock = Path.Combine(pastaTemp, "dados_banco.json");
            if (!File.Exists(caminhoBancoMock))
            {
                var dadosBancoVazio = queriesMontadas.Select(q => new RetornoBancoSimuladoDto
                {
                    PaginaInicio = q.PaginaInicio,
                    PaginaFim = q.PaginaFim,
                    DadosRetornados = new Dictionary<string, string>()
                }).ToList();

                await File.WriteAllTextAsync(caminhoBancoMock, JsonSerializer.Serialize(dadosBancoVazio, OpcoesJson));
            }
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
                        MensagemAuditoria = "Documento ausente nos dados retornados do banco."
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

                            var campoConfigurado = layout.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.NomeCampo) &&
                                c.NomeCampo.Trim().Equals(nomeCampoRegra, StringComparison.OrdinalIgnoreCase));

                            CampoExtraidoDto? campoExt = null;

                            if (campoConfigurado != null && campoConfigurado.Pagina > 0)
                            {
                                int paginaAbsolutaEsperada = doc.PaginaInicio + (campoConfigurado.Pagina - 1);
                                campoExt = doc.Campos?.FirstOrDefault(c =>
                                    !string.IsNullOrWhiteSpace(c?.Nome) &&
                                    c.Nome.Trim().Equals(nomeCampoRegra, StringComparison.OrdinalIgnoreCase) &&
                                    c.PaginaExtraido == paginaAbsolutaEsperada);
                            }

                            campoExt ??= doc.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.Nome) &&
                                c.Nome.Trim().Equals(nomeCampoRegra, StringComparison.OrdinalIgnoreCase));

                            int paginaExata = campoExt?.PaginaExtraido > 0
                                ? campoExt.PaginaExtraido
                                : (campoConfigurado != null && campoConfigurado.Pagina > 0
                                    ? doc.PaginaInicio + (campoConfigurado.Pagina - 1)
                                    : doc.PaginaInicio);

                            string extraido = campoExt?.ValorExtraido?.Trim() ?? string.Empty;

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