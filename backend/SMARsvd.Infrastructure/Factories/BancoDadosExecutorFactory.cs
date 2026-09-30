using SMARsvd.Application.Interfaces;

namespace SMARsvd.Infrastructure.Factories;

public class BancoDadosExecutorFactory : IBancoDadosExecutorFactory
{
    private readonly IEnumerable<IExecutorBancoDados> _executores;

    public BancoDadosExecutorFactory(IEnumerable<IExecutorBancoDados> executores)
    {
        _executores = executores;
    }

    public IExecutorBancoDados ObterExecutor(string? provedor)
    {
        if (string.IsNullOrWhiteSpace(provedor))
            throw new ArgumentException("Nenhum banco de dados foi selecionado na tela de validação.");

        var executor = _executores.FirstOrDefault(e =>
            e.ProvedorSuportado.Equals(provedor.Trim(), StringComparison.OrdinalIgnoreCase));

        if (executor == null)
        {
            throw new NotSupportedException(
                $"A conexão com o banco de dados '{provedor}' ainda não está disponível no sistema. O suporte atual contempla apenas o SQL Server.");
        }

        return executor;
    }
}