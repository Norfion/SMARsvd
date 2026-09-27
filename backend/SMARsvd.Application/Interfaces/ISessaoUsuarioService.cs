namespace SMARsvd.Application.Interfaces;

public interface ISessaoUsuarioService
{
    // Cada usuário só pode ter uma sessão ativa: retorna null quando já existe outra sessão em uso para ele.
    // Sessões encerradas ou abandonadas do mesmo usuário são descartadas ao criar a nova.
    string? CriarSessao(string usuario);

    // Valida o token, reativa a sessão caso tenha sido encerrada e contabiliza a requisição em andamento.
    // Retorna null quando o token não corresponde a nenhuma sessão.
    string? IniciarRequisicao(string token);

    void FinalizarRequisicao(string token);

    // Marca a sessão como encerrada; os dados do usuário só são removidos após o tempo de retenção
    void EncerrarSessao(string token);

    // Remove sessões encerradas ou sem atividade há mais tempo que o limite e sem requisições em andamento
    void RemoverSessoesInativas(TimeSpan tempoMaximoInatividade);

    bool UsuarioPossuiSessao(string usuario);
}
