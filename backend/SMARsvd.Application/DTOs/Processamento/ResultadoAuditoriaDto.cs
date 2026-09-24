using System.Collections.Generic;

namespace SMARsvd.Application.DTOs.Processamento;

public class InconsistenciaItemDto
{
    public int PaginaExtraido { get; set; }
    public string Campo { get; set; } = string.Empty;
    public string ValorExtraidoPdf { get; set; } = string.Empty;
    public string ValorEsperadoBanco { get; set; } = string.Empty;
    public string MensagemAuditoria { get; set; } = string.Empty;
}

public class ResultadoAuditoriaDto
{
    public string NomeArquivo { get; set; } = string.Empty;
    public string LayoutUtilizado { get; set; } = string.Empty;
    public int TotalDocumentosAnalisados { get; set; }
    public int DocumentosValidos { get; set; }
    public int DocumentosComInconsistencia { get; set; }
    public decimal Amostragem { get; set; }
    public bool UsouOcr { get; set; }

    public List<InconsistenciaItemDto> Inconsistencias { get; set; } = new();
    public List<ValidacaoDetalhadaDto> Validacoes { get; set; } = new();
}