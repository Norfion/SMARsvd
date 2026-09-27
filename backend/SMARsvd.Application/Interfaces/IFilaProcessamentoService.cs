namespace SMARsvd.Application.Interfaces;

public enum SituacaoFila
{
    // O usuário está com a vez e pode executar as etapas do processamento
    Liberado,
    // O usuário está aguardando; Posicao indica quantos ainda serão atendidos antes dele (1 = o próximo)
    NaFila,
    // Outra pessoa está processando e o usuário não pediu para entrar na fila; Posicao é a que ele ocuparia
    Ocupado,
    // O próprio usuário ainda possui uma etapa de processamento em execução
    ProcessamentoEmAndamento
}

public sealed record SituacaoFilaProcessamento(SituacaoFila Situacao, int Posicao = 0);

// Garante que apenas um usuário processe arquivos por vez; os demais são atendidos por ordem de chegada
public interface IFilaProcessamentoService
{
    // Também serve como consulta periódica de quem já está na fila, mantendo o lugar dele reservado
    SituacaoFilaProcessamento Entrar(string usuario, bool aguardarNaFila);

    // Sai da fila ou devolve a vez; se ainda houver etapa em execução, a vez é devolvida quando ela terminar
    void Sair(string usuario);

    // Retorna false quando o usuário não está com a vez
    bool IniciarEtapa(string usuario);

    void FinalizarEtapa(string usuario);
}
