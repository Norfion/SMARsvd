using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

public class SqlServerExecutorService : IExecutorBancoDados
{
    public string ProvedorSuportado => "SQL Server";

    private static string MontarConnectionString(ConfiguracaoBancoDto config)
    {
        if (string.IsNullOrWhiteSpace(config.Servidor))
            throw new ArgumentException("O endereço do servidor SQL Server não foi informado.");

        if (string.IsNullOrWhiteSpace(config.BaseDados))
            throw new ArgumentException("O nome do banco de dados não foi informado.");

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = config.Porta > 0 ? $"{config.Servidor},{config.Porta}" : config.Servidor,
            InitialCatalog = config.BaseDados,
            ConnectTimeout = 15,
            TrustServerCertificate = true,
            IntegratedSecurity = false
        };

        if (!string.IsNullOrWhiteSpace(config.Usuario))
        {
            builder.UserID = config.Usuario;
            builder.Password = config.Senha ?? string.Empty;
        }
        else
        {
            builder.IntegratedSecurity = true;
        }

        return builder.ConnectionString;
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
        var consultasPlanificadas = new List<(ItemRetornoQueryDto ItemRetorno, string Sql)>();

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

                // Guardamos a referência do item para preenchê-lo depois
                consultasPlanificadas.Add((itemRetorno, query.SqlRenderizado));
            }

            resultadosLote.Add(docRetorno);
        }

        if (consultasPlanificadas.Count == 0) return resultadosLote;

        // 2. Executar em lotes (Batching) para reduzir I/O de rede
        await using var conexao = new SqlConnection(cs);
        await conexao.OpenAsync();

        // Tamanho do lote: Envia 100 queries de cada vez para o SQL Server
        int tamanhoLote = 100;

        for (int i = 0; i < consultasPlanificadas.Count; i += tamanhoLote)
        {
            // Pega a "fatia" atual de consultas
            var loteAtual = consultasPlanificadas.GetRange(i, Math.Min(tamanhoLote, consultasPlanificadas.Count - i));

            // Concatena as queries separando-as por ponto e vírgula
            string batchSql = string.Join(";\n", loteAtual.Select(q => q.Sql));

            try
            {
                await using var comando = new SqlCommand(batchSql, conexao);
                comando.CommandTimeout = 120; // Tempo maior pois é um lote inteiro

                await using var reader = await comando.ExecuteReaderAsync();
                int indiceResultado = 0;

                // Navega pelos múltiplos retornos do lote
                do
                {
                    if (indiceResultado >= loteAtual.Count) break;

                    var item = loteAtual[indiceResultado].ItemRetorno;
                    try
                    {
                        while (await reader.ReadAsync())
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
                    try
                    {
                        await using var cmdIndividual = new SqlCommand(query.Sql, conexao);
                        cmdIndividual.CommandTimeout = 30;
                        await using var reader = await cmdIndividual.ExecuteReaderAsync();

                        while (await reader.ReadAsync())
                        {
                            var linha = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                            for (int col = 0; col < reader.FieldCount; col++)
                            {
                                string nomeColuna = reader.GetName(col);
                                string valor = reader.IsDBNull(col) ? string.Empty : reader.GetValue(col)?.ToString() ?? string.Empty;
                                linha[nomeColuna] = valor;
                            }
                            query.ItemRetorno.Registros.Add(linha);
                        }
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
}