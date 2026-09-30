using System.ComponentModel.DataAnnotations;
using SMARsvd.Domain.Enums;

namespace SMARsvd.Application.DTOs.Layout;

public class RegiaoCampoDto
{
    public Guid? Id { get; set; }

    [MaxLength(100)]
    public string NomeCampo { get; set; } = string.Empty;

    public decimal XMm { get; set; }
    public decimal YMm { get; set; }
    public decimal LarguraMm { get; set; }
    public decimal AlturaMm { get; set; }
    public int Pagina { get; set; } = 1;

    // Classificação única do campo
    public TipoClassificacaoCampo TipoClassificacao { get; set; } = TipoClassificacaoCampo.Nenhum;

    [MaxLength(250)]
    public string? TextoEsperadoDocumento { get; set; }

    [MaxLength(250)]
    public string? TextoEsperadoPagina { get; set; }

    [MaxLength(100)]
    public string? IdentificadorPagina { get; set; }

    [MaxLength(150)]
    public string? IdentificadorAnterior { get; set; }

    [MaxLength(150)]
    public string? IdentificadorPosterior { get; set; }

    public TipoDadoCampo TipoDado { get; set; } = TipoDadoCampo.Texto;

    [MaxLength(100_000)]
    public string? ConsultaSql { get; set; }
}
