namespace SMARsvp.Domain.Entities;

public class ConexaoBancoLayout
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LayoutClienteId { get; set; }
    public string Provedor { get; set; } = "SQL Server";
    public string Servidor { get; set; } = string.Empty;
    public int Porta { get; set; } = 1433;
    public string Usuario { get; set; } = string.Empty;
    public string? Senha { get; set; }

    public LayoutCliente? LayoutCliente { get; set; }
}