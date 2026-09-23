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

    // Identificador de Limite do Documento (Início/Fim do PDF)
    public bool EhIdentificadorInicio { get; set; }
    public string? TextoEsperadoInicio { get; set; }

    // ASSOCIAÇÃO: Informa a qual estrutura lógica a área pertence (Ex: "ENDERECO", "DEBITOS")
    public string IdentificadorPagina { get; set; } = string.Empty;

    // MARCADOR (Assinatura): Define se esta região física tem como finalidade classificar a página
    public bool EhIdentificadorPagina { get; set; }
    public string? TextoEsperadoPagina { get; set; }

    public string? IdentificadorAnterior { get; set; }
    public string? ConsultaSql { get; set; }

    public LayoutCliente? LayoutCliente { get; set; }
}