namespace SMARsvd.Application.DTOs;

public class LogRegistroDto
{
    public string Tipo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public string Origem { get; set; } = string.Empty;
    public DateTime DataHora { get; set; }
    public string? Detalhes { get; set; }
}
