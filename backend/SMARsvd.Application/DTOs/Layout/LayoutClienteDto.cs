using System.ComponentModel.DataAnnotations;

namespace SMARsvd.Application.DTOs.Layout;

public class LayoutClienteDto
{
    public Guid? Id { get; set; }

    [MaxLength(150)]
    public string Cliente { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NomeModelo { get; set; } = string.Empty;

    public int Versao { get; set; } = 1;
    public decimal LarguraPaginaMm { get; set; }
    public decimal AlturaPaginaMm { get; set; }

    [MaxLength(260)]
    public string? NomeArquivoModelo { get; set; }

    public List<RegiaoCampoDto> Campos { get; set; } = new();
    public List<QueryValidacaoDto> QueriesValidacao { get; set; } = new();
    public List<string> PaginasModeloBase64 { get; set; } = new();
}
