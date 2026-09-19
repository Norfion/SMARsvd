namespace SMARsvp.Application.DTOs.Layout;

public class ConexaoBancoLayoutDto
{
    public string Provedor { get; set; } = "SQL Server";
    public string Servidor { get; set; } = string.Empty;
    public int Porta { get; set; } = 1433;
    public string Usuario { get; set; } = string.Empty;
    public string? Senha { get; set; }
}

public class LayoutClienteDto
{
    public Guid? Id { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public string NomeModelo { get; set; } = string.Empty;
    public int Versao { get; set; } = 1;
    public string Orientacao { get; set; } = "Paisagem";
    public string FormatoPapel { get; set; } = "Personalizado";
    public decimal LarguraPaginaMm { get; set; }
    public decimal AlturaPaginaMm { get; set; }
    public int QuantidadePaginasPadrao { get; set; } = 1;
    public string? NomeArquivoModelo { get; set; }

    public ConexaoBancoLayoutDto? ConexaoBanco { get; set; }
    public List<RegiaoCampoDto> Campos { get; set; } = new();
    public List<QueryValidacaoDto> QueriesValidacao { get; set; } = new();
    public List<string> PaginasModeloBase64 { get; set; } = new();
}