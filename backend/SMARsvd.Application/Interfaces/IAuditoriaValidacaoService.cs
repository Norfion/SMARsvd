using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;

namespace SMARsvd.Application.Interfaces;

public interface IAuditoriaValidacaoService
{
    Task MontarQueriesEBuscarBancoAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string pastaTemp,
        ConfiguracaoBancoDto? conexaoBanco = null);

    Task<ResultadoAuditoriaDto> CompararEGerarAuditoriaAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string nomeArquivo,
        bool utilizouOcr,
        string pastaTemp,
        string usuario,
        DateTime? inicioProcessamento = null);
}