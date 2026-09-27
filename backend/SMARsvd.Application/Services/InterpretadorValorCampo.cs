using System.Text;
using System.Text.RegularExpressions;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;
using SMARsvd.Domain.Enums;

namespace SMARsvd.Application.Services;

public sealed record ResultadoInterpretacaoCampo(SituacaoValorCampo Situacao, string Valor, string? Motivo)
{
    public static ResultadoInterpretacaoCampo Ok(string valor) => new(SituacaoValorCampo.Ok, valor, null);
    public static ResultadoInterpretacaoCampo Ausente(string motivo) => new(SituacaoValorCampo.Ausente, string.Empty, motivo);
    public static ResultadoInterpretacaoCampo Invalido(string motivo) => new(SituacaoValorCampo.Invalido, string.Empty, motivo);
}

// Isola o valor de um campo dentro do texto lido na região demarcada,
// usando os identificadores anterior/posterior e o formato (tipo de dado) configurados.
public static class InterpretadorValorCampo
{
    private static readonly TimeSpan TempoLimiteRegex = TimeSpan.FromMilliseconds(500);

    // Impedem que o formato case com parte de outro token (ex.: "01" dentro de "01-0810-2-1370-000")
    private const string InicioToken = @"(?<![\w.,/\-])";
    private const string FimToken = @"(?![\w]|[.,/\-]\d)";

    private static readonly Dictionary<TipoDadoCampo, Regex> FormatosPredefinidos = new()
    {
        [TipoDadoCampo.Inteiro] = CriarFormatoToken(@"-?\d+"),
        [TipoDadoCampo.Decimal] = CriarFormatoToken(@"-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?"),
        [TipoDadoCampo.Data] = CriarFormatoToken(@"\d{2}[/.\-]\d{2}[/.\-]\d{4}"),
        [TipoDadoCampo.CpfCnpj] = CriarFormatoToken(@"\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}"),
        [TipoDadoCampo.Cep] = CriarFormatoToken(@"\d{5}-?\d{3}")
    };

    private static readonly char[] SeparadoresInicio = { ':', '-', ' ', '.', ',', '|' };
    private static readonly char[] SeparadoresFim = { ':', '-', ' ', ',', '|' };

    public static ResultadoInterpretacaoCampo Interpretar(string? textoRegiao, RegiaoCampoDto campo)
    {
        string texto = Regex.Replace(textoRegiao ?? string.Empty, @"\s+", " ").Trim();
        if (texto.Length == 0)
            return ResultadoInterpretacaoCampo.Ausente("Nenhum texto encontrado na região.");

        if (!string.IsNullOrWhiteSpace(campo.IdentificadorAnterior))
        {
            var ocorrencia = LocalizarIdentificador(texto, campo.IdentificadorAnterior);
            if (ocorrencia == null)
                return ResultadoInterpretacaoCampo.Ausente($"Identificador anterior '{campo.IdentificadorAnterior.Trim()}' não localizado na região.");

            texto = texto.Substring(ocorrencia.Index + ocorrencia.Length);
        }

        if (!string.IsNullOrWhiteSpace(campo.IdentificadorPosterior))
        {
            var ocorrencia = LocalizarIdentificador(texto, campo.IdentificadorPosterior);
            if (ocorrencia != null)
                texto = texto.Substring(0, ocorrencia.Index);
        }

        texto = texto.TrimStart(SeparadoresInicio).TrimEnd(SeparadoresFim).Trim();
        if (texto.Length == 0)
            return ResultadoInterpretacaoCampo.Ausente("Nenhum valor encontrado entre os identificadores configurados.");

        if (campo.TipoDado == TipoDadoCampo.Texto)
        {
            string valorTexto = AplicarLimpezaPorNomeCampo(texto, campo.NomeCampo);
            return valorTexto.Length == 0
                ? ResultadoInterpretacaoCampo.Ausente("Nenhum valor encontrado na região.")
                : ResultadoInterpretacaoCampo.Ok(valorTexto);
        }

        if (!FormatosPredefinidos.TryGetValue(campo.TipoDado, out var formato))
            return ResultadoInterpretacaoCampo.Invalido("Formato do campo não configurado.");

        Match correspondencia;
        try
        {
            correspondencia = formato.Match(texto);
        }
        catch (RegexMatchTimeoutException)
        {
            return ResultadoInterpretacaoCampo.Invalido("A avaliação do formato excedeu o tempo limite.");
        }

        if (!correspondencia.Success)
            return ResultadoInterpretacaoCampo.Invalido($"Valor fora do formato esperado ({ObterDescricaoTipo(campo.TipoDado)}).");

        return ResultadoInterpretacaoCampo.Ok(correspondencia.Value.Trim());
    }

    public static string ObterDescricaoTipo(TipoDadoCampo tipo) => tipo switch
    {
        TipoDadoCampo.Texto => "Texto",
        TipoDadoCampo.Inteiro => "Número inteiro",
        TipoDadoCampo.Decimal => "Número decimal",
        TipoDadoCampo.Data => "Data",
        TipoDadoCampo.CpfCnpj => "CPF/CNPJ",
        TipoDadoCampo.Cep => "CEP",
        _ => tipo.ToString()
    };

    private static Regex CriarFormatoToken(string padrao) =>
        new(InicioToken + "(?:" + padrao + ")" + FimToken, RegexOptions.CultureInvariant | RegexOptions.Compiled, TempoLimiteRegex);

    // Tolera variações de espaçamento do PDF/OCR, como "Ccm:" x "Ccm :" ou "Insc Municipal" x "InscMunicipal"
    private static Match? LocalizarIdentificador(string texto, string identificador)
    {
        var padrao = new StringBuilder();
        foreach (char caractere in identificador.Trim())
        {
            if (char.IsWhiteSpace(caractere))
                padrao.Append(@"\s*");
            else if (caractere is ':' or '-' or '.' or '/')
                padrao.Append(@"\s*").Append(Regex.Escape(caractere.ToString())).Append(@"\s*");
            else
                padrao.Append(Regex.Escape(caractere.ToString()));
        }

        var ocorrencia = Regex.Match(texto, padrao.ToString(), RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TempoLimiteRegex);
        return ocorrencia.Success ? ocorrencia : null;
    }

    // Layouts cadastrados antes da configuração de tipo de dado dependem desta limpeza baseada no nome do campo
    private static string AplicarLimpezaPorNomeCampo(string texto, string nomeCampo)
    {
        if (!Regex.IsMatch(nomeCampo, @"(?i)(CRC|Lote|Nro|Número|Parcela|Valor|Data|CEP|CPF|CNPJ)"))
            return texto;

        var primeiroDigito = Regex.Match(texto, @"\d");
        if (primeiroDigito.Success && primeiroDigito.Index > 0 && primeiroDigito.Index <= 6)
            texto = texto.Substring(primeiroDigito.Index).Trim();

        return Regex.Replace(texto, @"^[^\d]+|[^\d\.\,\-\/]+$", "").Trim();
    }
}
