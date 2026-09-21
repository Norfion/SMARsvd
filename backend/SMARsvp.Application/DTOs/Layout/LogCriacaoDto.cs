namespace SMARsvp.Application.DTOs;

public class LogCriacaoDto
{
    public string Tipo { get; set; } = "Erro";
    public string Mensagem { get; set; } = string.Empty;
    public string Origem { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    public string? Detalhes { get; set; }
}