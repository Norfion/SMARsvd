namespace SMARsvd.Domain.Entities;

public class LogSistema
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Tipo { get; set; } = string.Empty; // Ex: Erro, Informação, Aviso, Exceção
    public string Mensagem { get; set; } = string.Empty;
    public string Origem { get; set; } = string.Empty; // Ex: Front-end, Back-end, NomeDaClasse
    public DateTime DataHora { get; set; } = DateTime.UtcNow;
    public string? StackTrace { get; set; }
    public string? Detalhes { get; set; } // Pode conter Endpoint, Navegador, etc.
}