<<<<<<< HEAD
using System.Text.Json.Serialization;

namespace SMARsvd.Application.DTOs.Processamento;

public enum SituacaoValorCampo
{
    Ok = 0,
    // O valor não existe no documento (ex.: identificador anterior não localizado); segue como NULL nas consultas
    Ausente = 1,
    // O valor existe, mas não corresponde ao formato configurado; as consultas que dependem dele não são executadas
    Invalido = 2
}

=======
namespace SMARsvd.Application.DTOs.Processamento;

>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
// DTO exclusivo para o arquivo temporário 'documentos_estrutura.json'
// Contém apenas as delimitações de páginas do lote
public class DocumentoEstruturaDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
}

// DTO para os campos extraídos
public class CampoExtraidoDto
{
    public string Nome { get; set; } = string.Empty;
    public string ValorExtraido { get; set; } = string.Empty;
    public int PaginaExtraido { get; set; }
    public string ExtracaoMetodo { get; set; } = string.Empty;
<<<<<<< HEAD

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public SituacaoValorCampo Situacao { get; set; } = SituacaoValorCampo.Ok;

    public string? MensagemValidacao { get; set; }

    // Texto bruto lido na região, preenchido apenas quando o valor não pôde ser interpretado
    public string? TextoRegiao { get; set; }
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
}

// DTO para cada documento dentro de 'dados_extraidos.json'
public class DocumentoExtracaoDto
{
    public int PaginaInicio { get; set; }
    public int PaginaFim { get; set; }
    public List<CampoExtraidoDto> Campos { get; set; } = new();
}

// Objeto raiz salvo em 'dados_extraidos.json'
public class ResultadoProcessamentoDto
{
    public decimal PercentualAmostragem { get; set; }
    public int TotalDocumentos { get; set; }
    public int DocumentosProcessados { get; set; }
    public bool UsouOcr { get; set; }
    public List<DocumentoExtracaoDto> Documentos { get; set; } = new();

}