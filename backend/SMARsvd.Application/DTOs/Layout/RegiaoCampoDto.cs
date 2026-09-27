using SMARsvd.Domain.Enums;

namespace SMARsvd.Application.DTOs.Layout;

public class RegiaoCampoDto
{
    public Guid? Id { get; set; }
    public string NomeCampo { get; set; } = string.Empty;
    public decimal XMm { get; set; }
    public decimal YMm { get; set; }
    public decimal LarguraMm { get; set; }
    public decimal AlturaMm { get; set; }
    public int Pagina { get; set; } = 1;

    // Classificação única do campo
    public TipoClassificacaoCampo TipoClassificacao { get; set; } = TipoClassificacaoCampo.Nenhum;

    public string? TextoEsperadoDocumento { get; set; }
    public string? TextoEsperadoPagina { get; set; }
    public string? IdentificadorPagina { get; set; }
    public string? IdentificadorAnterior { get; set; }
    public string? IdentificadorPosterior { get; set; }
    public TipoDadoCampo TipoDado { get; set; } = TipoDadoCampo.Texto;
    public string? ConsultaSql { get; set; }
}