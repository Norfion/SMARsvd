namespace SMARsvd.Application.DTOs.Layout;

public class RegraValidacaoDto
{
    public Guid? Id { get; set; }
    public string CampoRetornado { get; set; } = string.Empty;
    public string Operador { get; set; } = "=";
    public string CampoCarne { get; set; } = string.Empty;
}

public class QueryValidacaoDto
{
    public Guid? Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Sql { get; set; } = string.Empty;
    public List<string> ParametrosEncontrados { get; set; } = new();
    public List<string> CamposRetornados { get; set; } = new();
    public List<RegraValidacaoDto> Regras { get; set; } = new();
}