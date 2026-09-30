using System.Text;
using System.Text.RegularExpressions;

namespace SMARsvd.Application.Services;

// Converte a consulta do layout ($Campo ou ${Campo}) em T-SQL com parâmetros (@nome), para que os valores lidos
// do PDF nunca sejam interpretados como SQL. Parâmetros escritos dentro de um literal ('%$Campo%') viram
// concatenação ('%' + @p + '%'); em comentários e identificadores delimitados ([...], "...") não são substituídos.
public sealed class ModeloConsultaParametrizada
{
    private static readonly Regex RegexParametro = new(@"\G(?:\$\{([^}]+)\}|\$([a-zA-Z0-9_]+))", RegexOptions.Compiled);

    public sealed class Trecho
    {
        public string? Codigo { get; init; }
        public string? NomeCampo { get; init; }
        public string? TextoOriginal { get; init; }
        public bool DentroDeLiteral { get; init; }
        public bool AbreLiteral { get; init; }
        public bool FechaLiteral { get; init; }
        public bool LiteralUnicode { get; init; }
    }

    public IReadOnlyList<Trecho> Trechos { get; }

    public IEnumerable<Trecho> Parametros => Trechos.Where(t => t.NomeCampo != null);

    private ModeloConsultaParametrizada(List<Trecho> trechos)
    {
        Trechos = trechos;
    }

    public static ModeloConsultaParametrizada Analisar(string sql)
    {
        var trechos = new List<Trecho>();
        var codigo = new StringBuilder();
        int i = 0;

        void EmitirCodigo()
        {
            if (codigo.Length == 0) return;
            trechos.Add(new Trecho { Codigo = codigo.ToString() });
            codigo.Clear();
        }

        while (i < sql.Length)
        {
            char c = sql[i];
            char proximo = i + 1 < sql.Length ? sql[i + 1] : '\0';

            if (c == '-' && proximo == '-')
            {
                int fim = sql.IndexOf('\n', i);
                fim = fim < 0 ? sql.Length : fim;
                codigo.Append(sql, i, fim - i);
                i = fim;
            }
            else if (c == '/' && proximo == '*')
            {
                int fim = FimComentarioBloco(sql, i);
                codigo.Append(sql, i, fim - i);
                i = fim;
            }
            else if (c == '[')
            {
                int fim = FimDelimitado(sql, i, ']');
                codigo.Append(sql, i, fim - i);
                i = fim;
            }
            else if (c == '"')
            {
                int fim = FimDelimitado(sql, i, '"');
                codigo.Append(sql, i, fim - i);
                i = fim;
            }
            else if (c == '\'' || ((c == 'N' || c == 'n') && proximo == '\'' && (i == 0 || !EhCaractereIdentificador(sql[i - 1]))))
            {
                bool unicode = c != '\'';
                int inicioConteudo = i + (unicode ? 2 : 1);
                int fimConteudo = FimLiteral(sql, inicioConteudo);

                if (fimConteudo < 0)
                {
                    // Literal sem fechamento: a consulta é recusada pelo validador, então apenas preserva o texto
                    codigo.Append(sql, i, sql.Length - i);
                    i = sql.Length;
                    continue;
                }

                string conteudo = sql.Substring(inicioConteudo, fimConteudo - inicioConteudo);
                int fimLiteral = fimConteudo + 1;

                if (!conteudo.Contains('$'))
                {
                    codigo.Append(sql, i, fimLiteral - i);
                }
                else
                {
                    EmitirCodigo();
                    AnalisarLiteral(conteudo, unicode, trechos);
                }

                i = fimLiteral;
            }
            else if (c == '$' && RegexParametro.Match(sql, i) is { Success: true } parametro)
            {
                EmitirCodigo();
                trechos.Add(new Trecho
                {
                    NomeCampo = ObterNomeCampo(parametro),
                    TextoOriginal = parametro.Value
                });
                i += parametro.Length;
            }
            else
            {
                codigo.Append(c);
                i++;
            }
        }

        EmitirCodigo();
        return new ModeloConsultaParametrizada(trechos);
    }

    // Divide o conteúdo do literal em partes de texto e parâmetros, que serão concatenados entre parênteses
    private static void AnalisarLiteral(string conteudo, bool unicode, List<Trecho> trechos)
    {
        var partes = new List<Trecho>();
        var texto = new StringBuilder();
        int i = 0;

        void EmitirTexto()
        {
            if (texto.Length == 0) return;
            partes.Add(new Trecho { Codigo = texto.ToString(), DentroDeLiteral = true, LiteralUnicode = unicode });
            texto.Clear();
        }

        while (i < conteudo.Length)
        {
            if (conteudo[i] == '$' && RegexParametro.Match(conteudo, i) is { Success: true } parametro)
            {
                EmitirTexto();
                partes.Add(new Trecho
                {
                    NomeCampo = ObterNomeCampo(parametro).Replace("''", "'"),
                    TextoOriginal = parametro.Value,
                    DentroDeLiteral = true
                });
                i += parametro.Length;
            }
            else
            {
                texto.Append(conteudo[i]);
                i++;
            }
        }

        EmitirTexto();

        for (int indice = 0; indice < partes.Count; indice++)
        {
            var parte = partes[indice];
            trechos.Add(new Trecho
            {
                Codigo = parte.Codigo,
                NomeCampo = parte.NomeCampo,
                TextoOriginal = parte.TextoOriginal,
                DentroDeLiteral = true,
                LiteralUnicode = parte.LiteralUnicode,
                AbreLiteral = indice == 0,
                FechaLiteral = indice == partes.Count - 1
            });
        }
    }

    // Monta o SQL executável: cada trecho de parâmetro recebe o nome devolvido por nomeParametro
    public string MontarSqlParametrizado(Func<Trecho, string> nomeParametro)
    {
        var sb = new StringBuilder();

        foreach (var trecho in Trechos)
        {
            if (trecho.DentroDeLiteral)
            {
                sb.Append(trecho.AbreLiteral ? "(" : " + ");

                if (trecho.NomeCampo != null)
                    sb.Append(nomeParametro(trecho));
                else
                    sb.Append(trecho.LiteralUnicode ? "N'" : "'").Append(trecho.Codigo).Append('\'');

                if (trecho.FechaLiteral)
                    sb.Append(')');
            }
            else
            {
                sb.Append(trecho.NomeCampo != null ? nomeParametro(trecho) : trecho.Codigo);
            }
        }

        return sb.ToString();
    }

    // Versão legível, com os valores no lugar dos parâmetros, usada apenas para exibir a consulta ao usuário
    public string MontarSqlExibicao(Func<Trecho, string> valorCodigo, Func<Trecho, string> valorLiteral)
    {
        var sb = new StringBuilder();
        bool literalAberto = false;

        foreach (var trecho in Trechos)
        {
            if (trecho.DentroDeLiteral)
            {
                if (trecho.AbreLiteral)
                {
                    sb.Append(trecho.LiteralUnicode ? "N'" : "'");
                    literalAberto = true;
                }

                sb.Append(trecho.NomeCampo != null ? valorLiteral(trecho).Replace("'", "''") : trecho.Codigo);

                if (trecho.FechaLiteral && literalAberto)
                {
                    sb.Append('\'');
                    literalAberto = false;
                }
            }
            else
            {
                sb.Append(trecho.NomeCampo != null ? valorCodigo(trecho) : trecho.Codigo);
            }
        }

        return sb.ToString();
    }

    private static string ObterNomeCampo(Match parametro) =>
        (parametro.Groups[1].Success ? parametro.Groups[1].Value : parametro.Groups[2].Value).Trim();

    private static bool EhCaractereIdentificador(char c) =>
        char.IsLetterOrDigit(c) || c is '_' or '@' or '#' or '$';

    // Devolve o índice do apóstrofo que fecha o literal ('' é um apóstrofo escapado), ou -1 se não fechar
    private static int FimLiteral(string sql, int inicioConteudo)
    {
        int i = inicioConteudo;
        while (i < sql.Length)
        {
            if (sql[i] == '\'')
            {
                if (i + 1 < sql.Length && sql[i + 1] == '\'')
                {
                    i += 2;
                    continue;
                }
                return i;
            }
            i++;
        }
        return -1;
    }

    private static int FimDelimitado(string sql, int inicio, char fechamento)
    {
        int i = inicio + 1;
        while (i < sql.Length)
        {
            if (sql[i] == fechamento)
            {
                if (i + 1 < sql.Length && sql[i + 1] == fechamento)
                {
                    i += 2;
                    continue;
                }
                return i + 1;
            }
            i++;
        }
        return sql.Length;
    }

    // Comentários de bloco do T-SQL podem ser aninhados
    private static int FimComentarioBloco(string sql, int inicio)
    {
        int profundidade = 0;
        int i = inicio;
        while (i < sql.Length - 1)
        {
            if (sql[i] == '/' && sql[i + 1] == '*')
            {
                profundidade++;
                i += 2;
            }
            else if (sql[i] == '*' && sql[i + 1] == '/')
            {
                profundidade--;
                i += 2;
                if (profundidade == 0) return i;
            }
            else
            {
                i++;
            }
        }
        return sql.Length;
    }
}
