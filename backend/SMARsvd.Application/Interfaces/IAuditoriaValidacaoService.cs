using System.Threading.Tasks;
using SMARsvd.Application.DTOs.Layout;
using SMARsvd.Application.DTOs.Processamento;

namespace SMARsvd.Application.Interfaces;

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
<<<<<<< HEAD
        string pastaTemp,
        DateTime? inicioProcessamento = null);
=======
        string pastaTemp);
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
}