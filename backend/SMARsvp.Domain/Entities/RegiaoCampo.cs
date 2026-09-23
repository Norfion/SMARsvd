using SMARsvp.Domain.Enums;

namespace SMARsvp.Domain.Entities;

public class RegiaoCampo
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LayoutClienteId { get; set; }
    public string NomeCampo { get; set; } = string.Empty;
    public decimal XMm { get; set; }
    public decimal YMm { get; set; }
    public decimal LarguraMm { get; set; }
    public decimal AlturaMm { get; set; }
    public int Pagina { get; set; } = 1;

    // Classificação única e mutuamente exclusiva
    public TipoClassificacaoCampo TipoClassificacao { get; set; } = TipoClassificacaoCampo.Nenhum;

    // Identificador de Limite do Documento (Início/Fim do lote no PDF)
    public string? TextoEsperadoDocumento { get; set; }

    // Identificador de Página: texto esperado que valida a estrutura/tipo da página
    public string? TextoEsperadoPagina { get; set; }

    // Vínculo para campo normal (Nenhum): nome do Identificador de Página ao qual este campo pertence
    public string? IdentificadorPagina { get; set; }

    // Campo normal: texto que precede o valor dentro da área demarcada
    public string? IdentificadorAnterior { get; set; }

    public string? ConsultaSql { get; set; }

    public LayoutCliente? LayoutCliente { get; set; }
}