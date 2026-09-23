namespace SMARsvp.Application.DTOs.Layout;

public class RegiaoCampoDto
{
    public Guid? Id { get; set; }
    public string NomeCampo { get; set; } = string.Empty;
    public decimal XMm { get; set; }
    public decimal YMm { get; set; }
    public decimal LarguraMm { get; set; }
    public decimal AlturaMm { get; set; }
    public int Pagina { get; set; } = 1;

    public bool EhIdentificadorInicio { get; set; }
    public string? TextoEsperadoInicio { get; set; }

    public string IdentificadorPagina { get; set; } = string.Empty;
    public bool EhIdentificadorPagina { get; set; }
    public string? TextoEsperadoPagina { get; set; }

    public string? IdentificadorAnterior { get; set; }
    public string? ConsultaSql { get; set; }

    public string? TipoDado { get; set; } = "Texto";
}