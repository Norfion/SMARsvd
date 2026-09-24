namespace SMARsvp.Application.Interfaces;

public interface IBancoDadosExecutorFactory
{
    IExecutorBancoDados ObterExecutor(string? provedor);
}