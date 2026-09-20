namespace SMARsvp.Application.DTOs.Processamento;

public class DocumentoEstruturaDto
{
    public int Documento { get; set; }
    public int Inicio { get; set; }
    public int Fim { get; set; }
    public List<CampoExtraidoDto> Campos { get; set; } = new();
}

public class CampoExtraidoDto
{
    public string Nome { get; set; } = string.Empty;
    public string Valor { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class ResultadoProcessamentoDto
{
    public decimal Amostragem { get; set; }
    public int TotalDocumentos { get; set; }
    public int DocumentosProcessados { get; set; }
    public List<DocumentoEstruturaDto> Documentos { get; set; } = new();
}