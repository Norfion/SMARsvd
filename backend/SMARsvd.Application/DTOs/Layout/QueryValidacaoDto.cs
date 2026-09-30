using System.ComponentModel.DataAnnotations;

namespace SMARsvd.Application.DTOs.Layout;

public class RegraValidacaoDto
{
    public Guid? Id { get; set; }

    [MaxLength(100)]
    public string CampoRetornado { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Operador { get; set; } = "=";

    [MaxLength(100)]
    public string CampoCarne { get; set; } = string.Empty;
}

public class QueryValidacaoDto
{
    public Guid? Id { get; set; }

    [MaxLength(100)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(100_000)]
    public string Sql { get; set; } = string.Empty;

    public List<string> ParametrosEncontrados { get; set; } = new();
    public List<string> CamposRetornados { get; set; } = new();
    public List<RegraValidacaoDto> Regras { get; set; } = new();
}
