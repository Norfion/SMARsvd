using SMARsvd.Application.DTOs.Layout;

namespace SMARsvd.Application.Interfaces;

public interface IValidadorConsultaSql
{
    // Verifica a sintaxe e garante que a consulta seja um único SELECT somente leitura
    ResultadoValidacaoSqlDto Validar(string sql);
}
