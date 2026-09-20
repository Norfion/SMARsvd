namespace SMARsvp.Application.DTOs.Processamento;

public class DocumentoEstruturaDto
{
    public int Documento { get; set; }
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public List<CampoExtraidoDto> Campos { get; set; } = new();
}

public class CampoExtraidoDto
{
    public string Nome { get; set; } = string.Empty;
    public string ValorExtraido { get; set; } = string.Empty;
    public int PaginaExtraido { get; set; }
    public string ExtracaoMetodo { get; set; } = string.Empty;
}

public class ResultadoProcessamentoDto
{
    public decimal PercentualAmostragem { get; set; }
    public int TotalDocumentos { get; set; }
    public int DocumentosProcessados { get; set; }
    public List<DocumentoEstruturaDto> Documentos { get; set; } = new();
}