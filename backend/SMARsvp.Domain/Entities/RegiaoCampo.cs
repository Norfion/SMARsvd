namespace SMARsvp.Domain.Entities;

public class RegiaoCampo
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LayoutClienteId { get; set; }
    public string NomeCampo { get; set; } = string.Empty;
    public decimal XMm { get; set; }
    public decimal YMm { get; set; }
    public decimal LarguraMm { get; set; }
    public decimal AlturaMm { get; set; }
    public int Pagina { get; set; } = 1;
    public bool EhIdentificadorPrimeiraPagina { get; set; }
    public string? TextoEsperadoIdentificador { get; set; }
    public string? IdentificadorAnterior { get; set; }
    public string? ConsultaSql { get; set; }

    public LayoutCliente? LayoutCliente { get; set; }
}