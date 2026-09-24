namespace SMARsvd.Application.DTOs.Processamento;

// DTO exclusivo para o arquivo temporário 'documentos_estrutura.json'
// Contém apenas as delimitações de páginas do lote
public class DocumentoEstruturaDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
}

// DTO para os campos extraídos
public class CampoExtraidoDto
{
    public string Nome { get; set; } = string.Empty;
    public string ValorExtraido { get; set; } = string.Empty;
    public int PaginaExtraido { get; set; }
    public string ExtracaoMetodo { get; set; } = string.Empty;
}

// DTO para cada documento dentro de 'dados_extraidos.json'
public class DocumentoExtracaoDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public List<CampoExtraidoDto> Campos { get; set; } = new();
}

// Objeto raiz salvo em 'dados_extraidos.json'
public class ResultadoProcessamentoDto
{
    public decimal PercentualAmostragem { get; set; }
    public int TotalDocumentos { get; set; }
    public int DocumentosProcessados { get; set; }
    public bool UsouOcr { get; set; }
    public List<DocumentoExtracaoDto> Documentos { get; set; } = new();

}