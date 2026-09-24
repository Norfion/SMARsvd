using System.Threading.Tasks;
using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.DTOs.Processamento;

namespace SMARsvp.Application.Interfaces;

public interface IAuditoriaValidacaoService
{
    Task<ResultadoAuditoriaDto> ProcessarAuditoriaSimuladaAsync(
        ResultadoProcessamentoDto extracao,
        LayoutClienteDto layout,
        string nomeArquivo,
        bool utilizouOcr,
        string pastaTemp,
        ConfiguracaoBancoDto? conexaoBanco = null);

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
        string pastaTemp);
}