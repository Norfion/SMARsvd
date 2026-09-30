using System.ComponentModel.DataAnnotations;

namespace SMARsvd.Application.DTOs;

public class LogCriacaoDto
{
    [MaxLength(50)]
    public string Tipo { get; set; } = "Erro";

    [Required, MaxLength(4000)]
    public string Mensagem { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Origem { get; set; } = string.Empty;

    [MaxLength(20000)]
    public string? StackTrace { get; set; }

    [MaxLength(20000)]
    public string? Detalhes { get; set; }

    // Sempre definido pelo servidor a partir da sessão, nunca pelo corpo da requisição
    public string? Usuario { get; set; }
}
