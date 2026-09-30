using System.Text.RegularExpressions;
using Microsoft.SqlServer.TransactSql.ScriptDom;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Services;

public class ValidadorConsultaSqlServer : IValidadorConsultaSql
{
    // Mesmo formato de parâmetro aceito na montagem das consultas ($Campo ou ${Campo})
    private static readonly Regex RegexParametro = new(@"\$\{([^}]+)\}|\$([a-zA-Z0-9_]+)", RegexOptions.Compiled);

    public ResultadoValidacaoSqlDto Validar(string sql)
    {
        var resultado = new ResultadoValidacaoSqlDto();

        if (string.IsNullOrWhiteSpace(sql))
        {
            AdicionarErro(resultado, 1, 1, "A instrução SQL está vazia.");
            return resultado;
        }

        // Os parâmetros viram um literal de mesmo tamanho para que linha/coluna dos erros continuem corretas
        string sqlParaAnalise = RegexParametro.Replace(sql, m => "0".PadRight(m.Length));

        var parser = new TSql160Parser(initialQuotedIdentifiers: true);
        TSqlFragment fragmento;
        IList<ParseError> errosSintaxe;
        using (var leitor = new StringReader(sqlParaAnalise))
        {
            fragmento = parser.Parse(leitor, out errosSintaxe);
        }

        if (errosSintaxe.Count > 0)
        {
            foreach (var erro in errosSintaxe)
            {
                AdicionarErro(resultado, erro.Line, erro.Column, $"Erro de sintaxe: {erro.Message}");
            }
            return resultado;
        }

        var instrucoes = (fragmento as TSqlScript)?.Batches.SelectMany(b => b.Statements).ToList()
                         ?? new List<TSqlStatement>();

        if (instrucoes.Count == 0)
        {
            AdicionarErro(resultado, 1, 1, "Nenhuma instrução SQL foi encontrada.");
            return resultado;
        }

        if (instrucoes.Count > 1)
        {
            var segunda = instrucoes[1];
            AdicionarErro(resultado, segunda.StartLine, segunda.StartColumn,
                "Informe apenas uma instrução SELECT por consulta.");
        }

        foreach (var instrucao in instrucoes)
        {
            if (instrucao is not SelectStatement select)
            {
                string comando = instrucao.ScriptTokenStream[instrucao.FirstTokenIndex].Text.ToUpperInvariant();
                AdicionarErro(resultado, instrucao.StartLine, instrucao.StartColumn,
                    $"Apenas consultas SELECT são permitidas. Comando encontrado: {comando}.");
                continue;
            }

            if (select.Into != null)
            {
                AdicionarErro(resultado, select.Into.StartLine, select.Into.StartColumn,
                    "SELECT ... INTO não é permitido, pois cria tabelas no banco de dados.");
            }

            var visitante = new VisitanteAcessoExterno();
            select.Accept(visitante);
            foreach (var (trecho, recurso) in visitante.Encontrados)
            {
                AdicionarErro(resultado, trecho.StartLine, trecho.StartColumn,
                    $"O uso de {recurso} não é permitido nas consultas de validação.");
            }
        }

        return resultado;
    }

    private static void AdicionarErro(ResultadoValidacaoSqlDto resultado, int linha, int coluna, string mensagem)
    {
        resultado.Erros.Add(new ErroSqlDto { Linha = linha, Coluna = coluna, Mensagem = mensagem });
    }

    // Funções que leem arquivos ou caminhos de rede do servidor (um caminho UNC faz o SQL Server se autenticar
    // em outra máquina, expondo a credencial da conta do serviço)
    private static readonly HashSet<string> FuncoesBloqueadas = new(StringComparer.OrdinalIgnoreCase)
    {
        "fn_trace_gettable",
        "fn_xe_file_target_read_file",
        "fn_xe_telemetry_blob_target_read_file",
        "fn_get_audit_file",
        "fn_get_audit_file_v2",
        "fn_dblog",
        "fn_dblog_xtp",
        "fn_full_dblog",
        "fn_dump_dblog",
        "dm_os_file_exists",
        "dm_os_enumerate_filesystem",
        "fn_MSxe_read_event_stream"
    };

    // Recursos que, mesmo dentro de um SELECT, permitem executar comandos, alterar dados ou ler dados fora do banco configurado
    private sealed class VisitanteAcessoExterno : TSqlFragmentVisitor
    {
        public List<(TSqlFragment Trecho, string Recurso)> Encontrados { get; } = new();

        public override void Visit(OpenRowsetTableReference node) => Encontrados.Add((node, "OPENROWSET"));
        public override void Visit(BulkOpenRowset node) => Encontrados.Add((node, "OPENROWSET(BULK ...)"));
        public override void Visit(OpenQueryTableReference node) => Encontrados.Add((node, "OPENQUERY"));
        public override void Visit(AdHocTableReference node) => Encontrados.Add((node, "OPENDATASOURCE"));
        public override void Visit(NextValueForExpression node) => Encontrados.Add((node, "NEXT VALUE FOR (altera sequências)"));

        public override void Visit(SchemaObjectName node)
        {
            if (node.ServerIdentifier != null)
                Encontrados.Add((node, $"servidor vinculado ({node.ServerIdentifier.Value})"));
        }

        public override void Visit(FunctionCall node) => VerificarFuncao(node, node.FunctionName?.Value);
        public override void Visit(SchemaObjectFunctionTableReference node) => VerificarFuncao(node, node.SchemaObject?.BaseIdentifier?.Value);
        public override void Visit(BuiltInFunctionTableReference node) => VerificarFuncao(node, node.Name?.Value);
        public override void Visit(GlobalFunctionTableReference node) => VerificarFuncao(node, node.Name?.Value);

        private void VerificarFuncao(TSqlFragment node, string? nome)
        {
            if (nome != null && FuncoesBloqueadas.Contains(nome))
                Encontrados.Add((node, nome));
        }
    }
}
