using System;
using System.Collections.Generic;
<<<<<<< HEAD
using System.Globalization;
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
using System.IO;
using System.Linq;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;
<<<<<<< HEAD
using SMARsvd.Domain.Enums;
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

namespace SMARsvd.Application.Services;

public class AuditoriaValidacaoService : IAuditoriaValidacaoService
{
    private readonly IBancoDadosExecutorFactory _bancoFactory;
<<<<<<< HEAD
    private readonly ILogService _logService;
    private readonly IValidadorConsultaSql _validadorSql;

    private static readonly CultureInfo CulturaBrasileira = CultureInfo.GetCultureInfo("pt-BR");

    // Usado para identificar, em queries_retornos.json, as consultas bloqueadas antes de chegar ao banco
    private const string PrefixoConsultaNaoExecutada = "Consulta não executada:";
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNameCaseInsensitive = true
    };

<<<<<<< HEAD
    public AuditoriaValidacaoService(
        IBancoDadosExecutorFactory bancoFactory,
        ILogService logService,
        IValidadorConsultaSql validadorSql)
    {
        _bancoFactory = bancoFactory;
        _logService = logService;
        _validadorSql = validadorSql;
=======
    public AuditoriaValidacaoService(IBancoDadosExecutorFactory bancoFactory)
    {
        _bancoFactory = bancoFactory;
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    }

    public async Task<ResultadoAuditoriaDto> ProcessarAuditoriaSimuladaAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string nomeArquivo,
        bool utilizouOcr,
        string pastaTemp,
        ConfiguracaoBancoDto? conexaoBanco = null)
    {
<<<<<<< HEAD
        var inicioProcessamento = DateTime.UtcNow;
        await MontarQueriesEBuscarBancoAsync(extracao, layout, pastaTemp, conexaoBanco);
        return await CompararEGerarAuditoriaAsync(extracao, layout, nomeArquivo, utilizouOcr, pastaTemp, inicioProcessamento);
=======
        await MontarQueriesEBuscarBancoAsync(extracao, layout, pastaTemp, conexaoBanco);
        return await CompararEGerarAuditoriaAsync(extracao, layout, nomeArquivo, utilizouOcr, pastaTemp);
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    }

    public async Task MontarQueriesEBuscarBancoAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string pastaTemp,
        ConfiguracaoBancoDto? conexaoBanco = null)
    {
        var queriesMontadas = new List<DocumentoQueriesDto>();

<<<<<<< HEAD
        var motivosBloqueio = new Dictionary<QueryValidacaoDto, string>();
        foreach (var query in layout?.QueriesValidacao ?? new List<QueryValidacaoDto>())
        {
            var validacao = _validadorSql.Validar(query.Sql ?? string.Empty);
            if (!validacao.Valida)
            {
                motivosBloqueio[query] = $"Consulta bloqueada: {string.Join(" ", validacao.Erros.Select(e => e.Mensagem))}";
            }
        }

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
                        var camposInvalidos = new List<string>();
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
                        string sqlRenderizado = query.Sql ?? string.Empty;

                        var matches = Regex.Matches(sqlRenderizado, @"\$\{([^}]+)\}|\$([a-zA-Z0-9_]+)");

                        foreach (Match match in matches)
                        {
                            string parametroSql = match.Value;
                            string nomeCampoBruto = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
                            string nomeCampo = nomeCampoBruto.Trim();

<<<<<<< HEAD
                            var campoExt = ObterCampoExtraido(doc, nomeCampo);
                            var campoLayout = layout.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.NomeCampo) &&
                                c.NomeCampo.Trim().Equals(nomeCampo, StringComparison.OrdinalIgnoreCase));

                            if (campoExt?.Situacao == SituacaoValorCampo.Invalido)
                            {
                                string motivo = string.IsNullOrWhiteSpace(campoExt.MensagemValidacao)
                                    ? "valor inválido"
                                    : campoExt.MensagemValidacao.TrimEnd('.');
                                camposInvalidos.Add($"'{campoExt.Nome}' ({motivo})");
                            }

                            string? valorBruto = campoExt?.Situacao == SituacaoValorCampo.Ok ? campoExt.ValorExtraido : null;
                            string valorSql = FormatarValorParaSql(valorBruto, campoLayout?.TipoDado ?? TipoDadoCampo.Texto);
=======
                            var campoExt = doc.Campos?.FirstOrDefault(c =>
                                !string.IsNullOrWhiteSpace(c?.Nome) &&
                                c.Nome.Trim().Equals(nomeCampo, StringComparison.OrdinalIgnoreCase));

                            string? valorBruto = campoExt?.ValorExtraido;
                            string valorSql = FormatarValorParaSql(valorBruto);
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

                            sqlRenderizado = sqlRenderizado.Replace(parametroSql, valorSql);
                            parametros[parametroSql] = valorBruto ?? "NULL";
                        }

                        docQueries.Queries.Add(new QueryMontadaDto
                        {
                            NomeQuery = query.Nome ?? "Query Sem Nome",
                            SqlOriginal = query.Sql ?? string.Empty,
                            SqlRenderizado = sqlRenderizado,
<<<<<<< HEAD
                            Parametros = parametros,
                            MotivoNaoExecucao = motivosBloqueio.TryGetValue(query, out var motivoBloqueio)
                                ? motivoBloqueio
                                : camposInvalidos.Any()
                                    ? $"{PrefixoConsultaNaoExecutada} campo(s) com valor inválido: {string.Join("; ", camposInvalidos.Distinct())}."
                                    : null
=======
                            Parametros = parametros
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
                    if (string.IsNullOrEmpty(item.Erro) && item.Registros.Any())
=======
                    if (item.Sucesso && item.Registros.Any())
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
        string pastaTemp,
        DateTime? inicioProcessamento = null)
    {
        string caminhoBancoMock = Path.Combine(pastaTemp, "dados_banco.json");
        var dadosBanco = new List<RetornoBancoSimuladoDto>();
        var falhas = new List<FalhaProcessamentoDto>();
=======
        string pastaTemp)
    {
        string caminhoBancoMock = Path.Combine(pastaTemp, "dados_banco.json");
        var dadosBanco = new List<RetornoBancoSimuladoDto>();
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

        if (File.Exists(caminhoBancoMock))
        {
            try
            {
                string bancoJson = await File.ReadAllTextAsync(caminhoBancoMock);
                dadosBanco = JsonSerializer.Deserialize<List<RetornoBancoSimuladoDto>>(bancoJson, OpcoesJson)
                             ?? new List<RetornoBancoSimuladoDto>();
            }
<<<<<<< HEAD
            catch (Exception ex)
            {
                dadosBanco = new List<RetornoBancoSimuladoDto>();
                falhas.Add(new FalhaProcessamentoDto
                {
                    Origem = "Leitura dos dados do banco",
                    Mensagem = $"Não foi possível ler o arquivo dados_banco.json: {ex.Message}"
                });
            }
        }

        falhas.AddRange(await ObterFalhasDasQueriesAsync(pastaTemp));

=======
            catch
            {
                dadosBanco = new List<RetornoBancoSimuladoDto>();
            }
        }

>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
        var resultadoAuditoria = new ResultadoAuditoriaDto
        {
            NomeArquivo = string.IsNullOrWhiteSpace(nomeArquivo) ? "arquivo_importado.pdf" : nomeArquivo,
            LayoutUtilizado = layout?.NomeModelo ?? "Layout Padrão",
            TotalDocumentosAnalisados = extracao?.DocumentosProcessados ?? 0,
<<<<<<< HEAD
            PercentualAmostragem = extracao?.PercentualAmostragem ?? 100,
=======
            Amostragem = extracao?.PercentualAmostragem ?? 100,
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
            UsouOcr = utilizouOcr,
            Inconsistencias = new List<InconsistenciaItemDto>(),
            Validacoes = new List<ValidacaoDetalhadaDto>()
        };

        int documentosComErro = 0;

<<<<<<< HEAD
        var dadosBancoPorDocumento = dadosBanco
            .GroupBy(d => (d.PaginaInicio, d.PaginaFim))
            .ToDictionary(g => g.Key, g => g.First());

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
        if (extracao?.Documentos != null)
        {
            foreach (var doc in extracao.Documentos)
            {
                bool temErroNoDoc = false;

<<<<<<< HEAD
                if (!dadosBancoPorDocumento.TryGetValue((doc.PaginaInicio, doc.PaginaFim), out var docBanco))
=======
                var docBanco = dadosBanco.FirstOrDefault(d =>
                    d.PaginaInicio == doc.PaginaInicio && d.PaginaFim == doc.PaginaFim);

                if (docBanco == null)
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
                            string mensagemDivergencia = MontarMensagemDivergencia(campoExt);
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

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
<<<<<<< HEAD
                                MensagemAuditoria = iguais ? "Valor validado com sucesso." : mensagemDivergencia
=======
                                MensagemAuditoria = iguais ? "Valor validado com sucesso." : "Divergência de valores."
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
                                    MensagemAuditoria = mensagemDivergencia
=======
                                    MensagemAuditoria = "Divergência de valores."
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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

<<<<<<< HEAD
        var dataHoraFim = DateTime.UtcNow;
        DateTime? dataHoraInicio = inicioProcessamento?.ToUniversalTime();

        if (dataHoraInicio.HasValue)
        {
            falhas.AddRange(await ObterFalhasDosLogsAsync(dataHoraInicio.Value, dataHoraFim));
        }

        resultadoAuditoria.DataHoraInicio = dataHoraInicio;
        resultadoAuditoria.DataHoraFim = dataHoraFim;
        resultadoAuditoria.Falhas = falhas;
        resultadoAuditoria.Inconsistencias = resultadoAuditoria.Inconsistencias
            .OrderBy(i => i.PaginaExtraido)
            .ToList();
        resultadoAuditoria.Validacoes = resultadoAuditoria.Validacoes
            .OrderBy(v => v.PaginaExtraido)
            .ToList();

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
        Directory.CreateDirectory(pastaTemp);
        string caminhoAuditoria = Path.Combine(pastaTemp, "resultado_auditoria.json");
        await File.WriteAllTextAsync(caminhoAuditoria, JsonSerializer.Serialize(resultadoAuditoria, OpcoesJson));

        return resultadoAuditoria;
    }

<<<<<<< HEAD
    private static async Task<List<FalhaProcessamentoDto>> ObterFalhasDasQueriesAsync(string pastaTemp)
    {
        var falhas = new List<FalhaProcessamentoDto>();
        string caminhoQueriesRetornos = Path.Combine(pastaTemp, "queries_retornos.json");

        if (!File.Exists(caminhoQueriesRetornos)) return falhas;

        try
        {
            string retornosJson = await File.ReadAllTextAsync(caminhoQueriesRetornos);
            var retornos = JsonSerializer.Deserialize<List<DocumentoRetornoQueriesDto>>(retornosJson, OpcoesJson)
                           ?? new List<DocumentoRetornoQueriesDto>();

            foreach (var docRetorno in retornos)
            {
                foreach (var item in docRetorno.Retornos.Where(r => !string.IsNullOrEmpty(r.Erro)))
                {
                    falhas.Add(new FalhaProcessamentoDto
                    {
                        Origem = item.Erro.StartsWith(PrefixoConsultaNaoExecutada, StringComparison.Ordinal)
                            ? "Validação dos campos extraídos"
                            : "Consulta ao banco de dados",
                        Mensagem = item.Erro,
                        PaginaInicio = docRetorno.PaginaInicio,
                        PaginaFim = docRetorno.PaginaFim,
                        NomeQuery = item.NomeQuery,
                        Detalhes = item.SqlExecutado
                    });
                }
            }
        }
        catch (Exception ex)
        {
            falhas.Add(new FalhaProcessamentoDto
            {
                Origem = "Consulta ao banco de dados",
                Mensagem = $"Não foi possível ler o arquivo queries_retornos.json: {ex.Message}"
            });
        }

        return falhas;
    }

    private async Task<List<FalhaProcessamentoDto>> ObterFalhasDosLogsAsync(DateTime inicioUtc, DateTime fimUtc)
    {
        try
        {
            var logs = await _logService.ListarFalhasPorPeriodoAsync(inicioUtc, fimUtc);

            return logs.Select(l => new FalhaProcessamentoDto
            {
                Origem = string.IsNullOrWhiteSpace(l.Origem) ? "Log do sistema" : l.Origem,
                Tipo = l.Tipo,
                Mensagem = l.Mensagem,
                Detalhes = l.Detalhes,
                DataHora = l.DataHora
            }).ToList();
        }
        catch (Exception ex)
        {
            return new List<FalhaProcessamentoDto>
            {
                new()
                {
                    Origem = "Log do sistema",
                    Mensagem = $"Não foi possível consultar os logs do período de validação: {ex.Message}"
                }
            };
        }
    }

    private static string MontarMensagemDivergencia(CampoExtraidoDto? campoExt)
    {
        if (campoExt == null || campoExt.Situacao == SituacaoValorCampo.Ok || string.IsNullOrWhiteSpace(campoExt.MensagemValidacao))
            return "Divergência de valores.";

        string mensagem = $"Divergência de valores. {campoExt.MensagemValidacao}";
        return string.IsNullOrWhiteSpace(campoExt.TextoRegiao)
            ? mensagem
            : $"{mensagem} Texto lido na região: '{campoExt.TextoRegiao}'.";
    }

    private static CampoExtraidoDto? ObterCampoExtraido(DocumentoExtracaoDto doc, string nomeCampo)
    {
        return doc.Campos?
            .Where(c => !string.IsNullOrWhiteSpace(c?.Nome) &&
                        c.Nome.Trim().Equals(nomeCampo, StringComparison.OrdinalIgnoreCase))
            .OrderBy(c => c.Situacao switch
            {
                SituacaoValorCampo.Ok => 0,
                SituacaoValorCampo.Invalido => 1,
                _ => 2
            })
            .FirstOrDefault();
    }

    private static string FormatarValorParaSql(string? valor, TipoDadoCampo tipoDado)
    {
        if (string.IsNullOrWhiteSpace(valor)) return "NULL";

        string valorTexto = $"'{valor.Replace("'", "''")}'";

        switch (tipoDado)
        {
            case TipoDadoCampo.Inteiro:
                return long.TryParse(valor, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var inteiro)
                    ? inteiro.ToString(CultureInfo.InvariantCulture)
                    : valorTexto;

            case TipoDadoCampo.Decimal:
                return decimal.TryParse(valor, NumberStyles.Number, CulturaBrasileira, out var numero)
                    ? numero.ToString(CultureInfo.InvariantCulture)
                    : valorTexto;

            case TipoDadoCampo.Texto:
                return decimal.TryParse(valor, out _) ? valor : valorTexto;

            default:
                return valorTexto;
        }
=======
    private static string FormatarValorParaSql(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return "NULL";
        if (decimal.TryParse(valor, out _)) return valor;
        return $"'{valor.Replace("'", "''")}'";
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    }
}