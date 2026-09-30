using System.Data;
using System.Globalization;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

public class SqlServerExecutorService : IExecutorBancoDados
{
    // O SQL Server aceita até 2100 parâmetros por comando
    private const int LimiteParametrosPorLote = 2000;
    private const int TamanhoMaximoLote = 100;

    // Só a primeira linha é usada na comparação; o limite evita carregar em memória consultas que retornem tabelas inteiras
    private const int MaximoRegistrosPorConsulta = 50;

    private readonly bool _confiarCertificadoServidor;

    public SqlServerExecutorService(IConfiguration configuration)
    {
        _confiarCertificadoServidor = configuration.GetValue("BancoDados:ConfiarCertificadoServidor", true);
    }

    public string ProvedorSuportado => "SQL Server";

    private string MontarConnectionString(ConfiguracaoBancoDto config)
    {
        if (string.IsNullOrWhiteSpace(config.Servidor))
            throw new ArgumentException("O endereço do servidor SQL Server não foi informado.");

        if (string.IsNullOrWhiteSpace(config.BaseDados))
            throw new ArgumentException("O nome do banco de dados não foi informado.");

        // Sem usuário a conexão usaria a conta Windows do servidor da API, e não a de quem está validando
        if (string.IsNullOrWhiteSpace(config.Usuario))
            throw new ArgumentException("O usuário do banco de dados não foi informado.");

        if (config.Porta < 0 || config.Porta > 65535)
            throw new ArgumentException("A porta do banco de dados é inválida.");

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = config.Porta > 0 ? $"{config.Servidor.Trim()},{config.Porta}" : config.Servidor.Trim(),
            InitialCatalog = config.BaseDados.Trim(),
            ConnectTimeout = 15,
            Encrypt = true,
            TrustServerCertificate = _confiarCertificadoServidor,
            IntegratedSecurity = false,
            PersistSecurityInfo = false,
            UserID = config.Usuario.Trim(),
            Password = config.Senha ?? string.Empty
        };

        return builder.ConnectionString;
    }

    private static SqlParameter CriarParametro(ParametroSqlDto parametro)
    {
        if (parametro.Valor == null)
            return new SqlParameter(parametro.Nome, SqlDbType.NVarChar, 4000) { Value = DBNull.Value };

        return parametro.Tipo switch
        {
            TipoParametroSql.Inteiro => new SqlParameter(parametro.Nome, SqlDbType.BigInt)
            {
                Value = long.Parse(parametro.Valor, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture)
            },
            TipoParametroSql.Decimal => new SqlParameter(parametro.Nome, SqlDbType.Decimal)
            {
                Value = decimal.Parse(parametro.Valor, NumberStyles.Number, CultureInfo.InvariantCulture)
            },
            _ => new SqlParameter(parametro.Nome, SqlDbType.NVarChar, parametro.Valor.Length <= 4000 ? 4000 : -1)
            {
                Value = parametro.Valor
            }
        };
    }

    private static SqlCommand CriarComando(string sql, IEnumerable<ParametroSqlDto> parametros, SqlConnection conexao, int timeout)
    {
        var comando = new SqlCommand(sql, conexao) { CommandTimeout = timeout };
        foreach (var parametro in parametros)
            comando.Parameters.Add(CriarParametro(parametro));
        return comando;
    }

    public async Task TestarConexaoAsync(ConfiguracaoBancoDto configuracao)
    {
        string cs = MontarConnectionString(configuracao);
        await using var conexao = new SqlConnection(cs);
        try
        {
            await conexao.OpenAsync();
        }
        catch (SqlException ex)
        {
            throw new InvalidOperationException($"Falha ao conectar no SQL Server ({configuracao.Servidor}): {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Não foi possível estabelecer conexão com o banco de dados: {ex.Message}", ex);
        }
    }

    public async Task<List<DocumentoRetornoQueriesDto>> ExecutarLoteQueriesAsync(
        List<DocumentoQueriesDto> loteQueries,
        ConfiguracaoBancoDto configuracao)
    {
        await TestarConexaoAsync(configuracao);

        string cs = MontarConnectionString(configuracao);
        var resultadosLote = new List<DocumentoRetornoQueriesDto>();

        // 1. Preparar a estrutura de retorno e "planificar" as consultas para facilitar o lote
        var consultasPlanificadas = new List<(ItemRetornoQueryDto ItemRetorno, string Sql, List<ParametroSqlDto> Parametros)>();

        foreach (var docQuery in loteQueries)
        {
            var docRetorno = new DocumentoRetornoQueriesDto
            {
                PaginaInicio = docQuery.PaginaInicio,
                PaginaFim = docQuery.PaginaFim,
                Retornos = new List<ItemRetornoQueryDto>()
            };

            foreach (var query in docQuery.Queries)
            {
                var itemRetorno = new ItemRetornoQueryDto
                {
                    NomeQuery = query.NomeQuery,
                    SqlExecutado = query.SqlRenderizado,
                    // Só é limpo quando o resultado da consulta é lido com sucesso
                    Erro = "Falha ao executar a consulta."
                };
                docRetorno.Retornos.Add(itemRetorno);

                if (!string.IsNullOrWhiteSpace(query.MotivoNaoExecucao))
                {
                    itemRetorno.Erro = query.MotivoNaoExecucao;
                    continue;
                }

                if (string.IsNullOrWhiteSpace(query.SqlParametrizado))
                {
                    itemRetorno.Erro = "Consulta não executada: a consulta não pôde ser montada.";
                    continue;
                }

                // Guardamos a referência do item para preenchê-lo depois
                consultasPlanificadas.Add((itemRetorno, query.SqlParametrizado, query.ParametrosSql ?? new List<ParametroSqlDto>()));
            }

            resultadosLote.Add(docRetorno);
        }

        if (consultasPlanificadas.Count == 0) return resultadosLote;

        // 2. Executar em lotes (Batching) para reduzir I/O de rede
        await using var conexao = new SqlConnection(cs);
        await conexao.OpenAsync();

        int i = 0;
        while (i < consultasPlanificadas.Count)
        {
            // Monta a "fatia" atual respeitando o número de consultas e o limite de parâmetros do SQL Server
            int fim = i;
            int totalParametros = 0;
            while (fim < consultasPlanificadas.Count
                   && fim - i < TamanhoMaximoLote
                   && (fim == i || totalParametros + consultasPlanificadas[fim].Parametros.Count <= LimiteParametrosPorLote))
            {
                totalParametros += consultasPlanificadas[fim].Parametros.Count;
                fim++;
            }

            var loteAtual = consultasPlanificadas.GetRange(i, fim - i);
            i = fim;

            // Concatena as queries separando-as por ponto e vírgula; os nomes dos parâmetros são únicos no lote
            string batchSql = string.Join(";\n", loteAtual.Select(q => q.Sql));

            try
            {
                await using var comando = CriarComando(batchSql, loteAtual.SelectMany(q => q.Parametros), conexao, 120);

                await using var reader = await comando.ExecuteReaderAsync();
                int indiceResultado = 0;

                // Navega pelos múltiplos retornos do lote
                do
                {
                    if (indiceResultado >= loteAtual.Count) break;

                    var item = loteAtual[indiceResultado].ItemRetorno;
                    try
                    {
                        await LerRegistrosAsync(reader, item);
                        item.Erro = string.Empty;
                    }
                    catch (Exception exLeitura)
                    {
                        item.Erro = exLeitura.Message;
                    }

                    indiceResultado++;
                } while (await reader.NextResultAsync()); // Pula para o resultado da próxima query do lote
            }
            catch (Exception)
            {
                // FALLBACK DE SEGURANÇA:
                // Se o lote inteiro falhar (ex: erro de sintaxe fatal em uma única query abortou o batch),
                // executamos individualmente apenas este lote, isolando a query problemática e salvando as corretas.
                foreach (var query in loteAtual)
                {
                    query.ItemRetorno.Registros.Clear();
                    try
                    {
                        await using var cmdIndividual = CriarComando(query.Sql, query.Parametros, conexao, 30);
                        await using var reader = await cmdIndividual.ExecuteReaderAsync();

                        await LerRegistrosAsync(reader, query.ItemRetorno);
                        query.ItemRetorno.Erro = string.Empty;
                    }
                    catch (Exception exIndividual)
                    {
                        query.ItemRetorno.Erro = exIndividual.Message;
                    }
                }
            }
        }

        return resultadosLote;
    }

    private static async Task LerRegistrosAsync(SqlDataReader reader, ItemRetornoQueryDto item)
    {
        while (item.Registros.Count < MaximoRegistrosPorConsulta && await reader.ReadAsync())
        {
            var linha = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int col = 0; col < reader.FieldCount; col++)
            {
                string nomeColuna = reader.GetName(col);
                string valor = reader.IsDBNull(col) ? string.Empty : reader.GetValue(col)?.ToString() ?? string.Empty;
                linha[nomeColuna] = valor;
            }
            item.Registros.Add(linha);
        }
    }
}