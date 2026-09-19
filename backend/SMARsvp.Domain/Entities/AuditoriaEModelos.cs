namespace SMARsvp.Domain.Entities;

public class QueryValidacao
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LayoutClienteId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Sql { get; set; } = string.Empty;

    // Regras associadas a esta query
    public ICollection<RegraValidacao> Regras { get; set; } = new List<RegraValidacao>();
    public LayoutCliente? LayoutCliente { get; set; }
}

public class RegraValidacao
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QueryValidacaoId { get; set; }
    public string CampoRetornado { get; set; } = string.Empty;
    public string Operador { get; set; } = "=";
    public string CampoCarne { get; set; } = string.Empty;

    public QueryValidacao? QueryValidacao { get; set; }
}

public class PaginaModeloImagem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LayoutClienteId { get; set; }
    public int NumeroPagina { get; set; }
    public string ImagemBase64 { get; set; } = string.Empty;

    public LayoutCliente? LayoutCliente { get; set; }
}