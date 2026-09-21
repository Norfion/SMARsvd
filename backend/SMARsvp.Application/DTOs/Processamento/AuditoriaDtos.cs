using System.Collections.Generic;

namespace SMARsvp.Application.DTOs.Processamento;

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

public class RetornoBancoSimuladoDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public Dictionary<string, string> DadosRetornados { get; set; } = new();
}

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