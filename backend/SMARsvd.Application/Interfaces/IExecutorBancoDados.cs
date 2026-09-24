using System.Collections.Generic;
using System.Threading.Tasks;
using SMARsvd.Application.DTOs.Processamento;

namespace SMARsvd.Application.Interfaces;

public interface IExecutorBancoDados
{
    string ProvedorSuportado { get; }
    Task TestarConexaoAsync(ConfiguracaoBancoDto configuracao);
    Task<List<DocumentoRetornoQueriesDto>> ExecutarLoteQueriesAsync(
        List<DocumentoQueriesDto> loteQueries,
        ConfiguracaoBancoDto configuracao);
}