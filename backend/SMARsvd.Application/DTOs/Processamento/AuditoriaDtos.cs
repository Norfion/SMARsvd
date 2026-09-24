using System.Collections.Generic;

namespace SMARsvd.Application.DTOs.Processamento;

public class ConfiguracaoBancoDto
{
    public string Provedor { get; set; } = "SQL Server";
    public string Servidor { get; set; } = string.Empty;
    public int Porta { get; set; } = 1433;
    public string BaseDados { get; set; } = string.Empty;
    public string Usuario { get; set; } = string.Empty;
    public string? Senha { get; set; }
}

public class QueryMontadaDto
{
    public string NomeQuery { get; set; } = string.Empty;
    public string SqlOriginal { get; set; } = string.Empty;
    public string SqlRenderizado { get; set; } = string.Empty;
    public Dictionary<string, string> Parametros { get; set; } = new();
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
    public bool Sucesso { get; set; }
    public string? Erro { get; set; }
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