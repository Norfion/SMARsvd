<<<<<<< HEAD
using System;
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
using System.Collections.Generic;

namespace SMARsvd.Application.DTOs.Processamento;

<<<<<<< HEAD
public class FalhaProcessamentoDto
{
    public string Origem { get; set; } = string.Empty;
    public string Tipo { get; set; } = "Erro";
    public string Mensagem { get; set; } = string.Empty;
    public int? PaginaInicio { get; set; }
    public int? PaginaFim { get; set; }
    public string? NomeQuery { get; set; }
    public string? Detalhes { get; set; }
    public DateTime? DataHora { get; set; }
}

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
    public decimal PercentualAmostragem { get; set; }
    public bool UsouOcr { get; set; }

    public DateTime? DataHoraInicio { get; set; }
    public DateTime DataHoraFim { get; set; }

    public List<FalhaProcessamentoDto> Falhas { get; set; } = new();
=======
    public decimal Amostragem { get; set; }
    public bool UsouOcr { get; set; }

>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    public List<InconsistenciaItemDto> Inconsistencias { get; set; } = new();
    public List<ValidacaoDetalhadaDto> Validacoes { get; set; } = new();
}