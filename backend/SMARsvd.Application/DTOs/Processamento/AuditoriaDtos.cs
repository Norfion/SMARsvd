using System.ComponentModel.DataAnnotations;

namespace SMARsvd.Application.DTOs.Processamento;

public class ConfiguracaoBancoDto
{
    [MaxLength(50)]
    public string Provedor { get; set; } = "SQL Server";

    [MaxLength(255)]
    public string Servidor { get; set; } = string.Empty;

    [Range(0, 65535)]
    public int Porta { get; set; } = 1433;

    [MaxLength(128)]
    public string BaseDados { get; set; } = string.Empty;

    [MaxLength(128)]
    public string Usuario { get; set; } = string.Empty;

    [MaxLength(512)]
    public string? Senha { get; set; }
}

public enum TipoParametroSql
{
    Texto,
    Inteiro,
    Decimal
}

public class ParametroSqlDto
{
    public string Nome { get; set; } = string.Empty;
    // Inteiro e Decimal ficam no formato invariante; nulo é enviado como NULL
    public string? Valor { get; set; }
    public TipoParametroSql Tipo { get; set; }
}

public class QueryMontadaDto
{
    public string NomeQuery { get; set; } = string.Empty;
    public string SqlOriginal { get; set; } = string.Empty;
    // Apenas para exibição ao usuário; o que vai ao banco é SqlParametrizado com ParametrosSql
    public string SqlRenderizado { get; set; } = string.Empty;
    public string SqlParametrizado { get; set; } = string.Empty;
    public List<ParametroSqlDto> ParametrosSql { get; set; } = new();
    public Dictionary<string, string> Parametros { get; set; } = new();

    // Preenchido quando algum campo usado na consulta tem valor inválido; nesse caso a consulta não é executada
    public string? MotivoNaoExecucao { get; set; }
}

public class DocumentoQueriesDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public List<QueryMontadaDto> Queries { get; set; } = new();
}

// Representação de cada query executada no banco de dados
public class ItemRetornoQueryDto
{
    public string NomeQuery { get; set; } = string.Empty;
    public string SqlExecutado { get; set; } = string.Empty;
    // Vazio indica que a consulta foi executada com sucesso
    public string Erro { get; set; } = string.Empty;
    public List<Dictionary<string, string>> Registros { get; set; } = new();
}

// Representação agrupada por documento para o arquivo 'queries_retornos.json'
public class DocumentoRetornoQueriesDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public List<ItemRetornoQueryDto> Retornos { get; set; } = new();
}

// Representação consolidada para o arquivo 'dados_banco.json'
public class RetornoBancoSimuladoDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public Dictionary<string, string> DadosRetornados { get; set; } = new();
}

// Detalhamento individual de conferência por campo/regra
public class ValidacaoDetalhadaDto
{
    public int PaginaExtraido { get; set; }
    public string NomeQuery { get; set; } = string.Empty;
    public string CampoLayout { get; set; } = string.Empty;
    public string CampoBanco { get; set; } = string.Empty;
    public string RegraAplicada { get; set; } = string.Empty;
    public string ValorExtraido { get; set; } = string.Empty;
    public string ValorBanco { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string MensagemAuditoria { get; set; } = string.Empty;
}