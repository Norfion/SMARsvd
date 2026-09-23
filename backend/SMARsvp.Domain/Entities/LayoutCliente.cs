namespace SMARsvp.Domain.Entities;

public class LayoutCliente
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Cliente { get; set; } = string.Empty;
    public string NomeModelo { get; set; } = string.Empty;
    public int Versao { get; set; } = 1;
    public decimal LarguraPaginaMm { get; set; }
    public decimal AlturaPaginaMm { get; set; }
    public string? NomeArquivoModelo { get; set; }

    // Coleções filhas persistidas
    public ICollection<RegiaoCampo> Campos { get; set; } = new List<RegiaoCampo>();
    public ICollection<QueryValidacao> QueriesValidacao { get; set; } = new List<QueryValidacao>();
    public ICollection<PaginaModeloImagem> PaginasModelo { get; set; } = new List<PaginaModeloImagem>();
}