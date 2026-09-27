namespace SMARsvd.Application.DTOs.Layout;

public class ValidarSqlRequest
{
    public string Sql { get; set; } = string.Empty;
}

public class ErroSqlDto
{
    public int Linha { get; set; }
    public int Coluna { get; set; }
    public string Mensagem { get; set; } = string.Empty;
}

public class ResultadoValidacaoSqlDto
{
    public bool Valida => Erros.Count == 0;
    public List<ErroSqlDto> Erros { get; set; } = new();
}
