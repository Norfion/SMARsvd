using SMARsvp.Domain.Enums;

namespace SMARsvp.Domain.Entities;

public class LayoutCliente
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Cliente { get; set; } = string.Empty;
    public string NomeModelo { get; set; } = string.Empty;
    public int Versao { get; set; } = 1;
    public OrientacaoPagina Orientacao { get; set; }
    public FormatoPapel FormatoPapel { get; set; }
    public decimal LarguraPaginaMm { get; set; }
    public decimal AlturaPaginaMm { get; set; }
    public int QuantidadePaginasPadrao { get; set; } = 1;
    public string? NomeArquivoModelo { get; set; }

    // Relação 1:1 com as credenciais de banco do município
    public ConexaoBancoLayout? ConexaoBanco { get; set; }

    // Coleções filhas
    public ICollection<RegiaoCampo> Campos { get; set; } = new List<RegiaoCampo>();
    public ICollection<QueryValidacao> QueriesValidacao { get; set; } = new List<QueryValidacao>();
    public ICollection<PaginaModeloImagem> PaginasModelo { get; set; } = new List<PaginaModeloImagem>();
}