namespace SMARsvd.Application.Interfaces;

public interface IBancoDadosExecutorFactory
{
    IExecutorBancoDados ObterExecutor(string? provedor);
}