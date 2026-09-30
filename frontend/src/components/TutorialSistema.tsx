import { useEffect, useRef, useState } from "react";
import { NOME_SISTEMA } from "../constants/identificacaoSistema";

interface EtapaTutorial {
  icone: string;
  titulo: string;
  descricao: string;
  topicos: string[];
  dica?: string;
}

const ETAPAS_TUTORIAL: EtapaTutorial[] = [
  {
    icone: "fas fa-hand-sparkles",
    titulo: `Bem-vindo ao ${NOME_SISTEMA}`,
    descricao:
      "O sistema confere, de forma automática, se os carnês e guias emitidos em PDF trazem as mesmas informações registradas no banco de dados da prefeitura.",
    topicos: [
      "Configurações: ensine o sistema a ler cada modelo de documento.",
      "Validação: envie um arquivo PDF para ser conferido.",
      "Resultado: analise as divergências encontradas e exporte o relatório.",
    ],
    dica: "Este tutorial leva menos de um minuto. Use as setas do teclado para avançar ou voltar.",
  },
  {
    icone: "fas fa-bars",
    titulo: "Menu lateral",
    descricao:
      "As três telas principais ficam no menu à esquerda. Clique em um item para abrir a tela correspondente.",
    topicos: [
      "A tela ativa fica destacada no menu e aparece no caminho acima do conteúdo.",
      "A seta no rodapé do menu recolhe ou expande o menu, liberando espaço na tela.",
      "Se houver alterações não salvas em um layout, o sistema avisa antes de trocar de tela.",
    ],
  },
  {
    icone: "fas fa-cogs",
    titulo: "Configurações",
    descricao:
      "Aqui são criados os layouts, que indicam onde fica cada informação no documento e como ela deve ser conferida. Normalmente é feito uma única vez para cada modelo de carnê.",
    topicos: [
      "Clique em Novo e importe um PDF de exemplo (até 10 páginas e 20 MB) ou crie o layout manualmente.",
      "Desenhe retângulos sobre as áreas do documento e escolha o tipo de cada campo: identificador de documento, identificador de página ou campo comum.",
      "Nas regras de validação, escreva a consulta SELECT usando os campos lidos (ex.: $Inscricao) e clique em Analisar.",
      "Indique qual coluna do banco deve ser comparada com qual campo e salve o layout.",
    ],
    dica: "Todo layout precisa de um identificador de documento: é ele que mostra onde cada carnê começa dentro do arquivo.",
  },
  {
    icone: "fas fa-clipboard-check",
    titulo: "Validação",
    descricao:
      "Nesta tela um arquivo PDF é conferido com base em um layout salvo.",
    topicos: [
      "Informe a conexão com o banco de dados da prefeitura. As credenciais não são salvas; prefira um usuário somente leitura.",
      "Escolha o layout e selecione o arquivo PDF a ser conferido.",
      "Defina o modo: validar integralmente (mais seguro) ou por amostragem (mais rápido).",
      "Clique em Validar e acompanhe as etapas. Ao final, a tela de Resultado é aberta automaticamente.",
    ],
    dica: "Apenas uma validação é processada por vez. Se outra pessoa estiver validando, você pode entrar na fila.",
  },
  {
    icone: "fas fa-chart-bar",
    titulo: "Resultado",
    descricao:
      "Apresenta o resumo da validação e cada conferência realizada.",
    topicos: [
      "Os indicadores mostram o total de documentos analisados, os válidos e os com inconsistências.",
      "A tabela exibe, por padrão, apenas as divergências. Altere o filtro de situação para ver tudo.",
      "O botão Mostrar falhas aparece quando algo impediu parte da conferência.",
      "Exporte o relatório em PDF, Excel ou CSV.",
    ],
    dica: "Os resultados não ficam guardados. Exporte o relatório antes de sair do sistema.",
  },
  {
    icone: "fas fa-flag-checkered",
    titulo: "Tudo pronto!",
    descricao: "Você já conhece as principais funcionalidades do sistema.",
    topicos: [
      "Para rever este tutorial, clique no botão Tutorial, no canto superior direito.",
      "Ao fechar a aba do navegador, a sessão é encerrada e os dados processados são apagados do servidor após 5 minutos.",
    ],
  },
];

interface TutorialSistemaProps {
  aoFinalizar: () => void;
}

// Apresentação em etapas das principais funcionalidades, exibida no primeiro acesso ou pelo botão "Tutorial"
export function TutorialSistema({ aoFinalizar }: TutorialSistemaProps) {
  const [etapaAtual, setEtapaAtual] = useState<number>(0);

  const ehPrimeiraEtapa = etapaAtual === 0;
  const ehUltimaEtapa = etapaAtual === ETAPAS_TUTORIAL.length - 1;

  const aoFinalizarRef = useRef(aoFinalizar);
  useEffect(() => {
    aoFinalizarRef.current = aoFinalizar;
  });

  useEffect(() => {
    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFinalizarRef.current();
      if (evento.key === "ArrowRight") {
        setEtapaAtual((atual) =>
          Math.min(atual + 1, ETAPAS_TUTORIAL.length - 1),
        );
      }
      if (evento.key === "ArrowLeft") {
        setEtapaAtual((atual) => Math.max(atual - 1, 0));
      }
    };
    document.addEventListener("keydown", aoPressionarTecla);
    return () => document.removeEventListener("keydown", aoPressionarTecla);
  }, []);

  return (
    <>
      <div className="modal-backdrop show"></div>
      <div
        id="modal-tutorial-sistema"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-etapa-tutorial"
        tabIndex={-1}
      >
        <div className="modal-dialog modal-tutorial">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">
                <h3>Tutorial</h3>
              </div>
              <span className="tutorial-contador">
                Etapa {etapaAtual + 1} de {ETAPAS_TUTORIAL.length}
              </span>
            </div>

            {/* Todas as etapas ocupam a mesma célula para o corpo manter a altura da maior e os botões não mudarem de lugar */}
            <div className="modal-body tutorial-corpo">
              {ETAPAS_TUTORIAL.map((item, indice) => {
                const ehEtapaAtual = indice === etapaAtual;
                return (
                  <div
                    key={item.titulo}
                    className={`tutorial-etapa ${ehEtapaAtual ? "ativa" : ""}`}
                    aria-hidden={!ehEtapaAtual}
                  >
                    <div className="tutorial-icone">
                      <i className={item.icone}></i>
                    </div>

                    <div className="tutorial-conteudo">
                      <h4
                        id={ehEtapaAtual ? "titulo-etapa-tutorial" : undefined}
                      >
                        {item.titulo}
                      </h4>
                      <p>{item.descricao}</p>
                      <ul>
                        {item.topicos.map((topico) => (
                          <li key={topico}>{topico}</li>
                        ))}
                      </ul>

                      {item.dica && (
                        <div className="alert alert-inline alert-info mb-0">
                          <i className="fas fa-lightbulb"></i>
                          <span>{item.dica}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="tutorial-indicadores">
              {ETAPAS_TUTORIAL.map((item, indice) => (
                <button
                  key={item.titulo}
                  type="button"
                  className={`tutorial-indicador ${indice === etapaAtual ? "ativo" : ""}`}
                  onClick={() => setEtapaAtual(indice)}
                  aria-label={`Ir para a etapa ${indice + 1}: ${item.titulo}`}
                  title={item.titulo}
                ></button>
              ))}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                id="btn-pular-tutorial"
                className={`btn btn-link mr-auto ${ehUltimaEtapa ? "invisible" : ""}`}
                onClick={aoFinalizar}
                aria-hidden={ehUltimaEtapa}
              >
                Pular tutorial
              </button>

              <button
                type="button"
                id="btn-etapa-anterior-tutorial"
                className="btn btn-cancel tutorial-botao-navegacao"
                onClick={() => setEtapaAtual((atual) => Math.max(atual - 1, 0))}
                disabled={ehPrimeiraEtapa}
              >
                <i className="fas fa-chevron-left"></i> Anterior
              </button>

              {ehUltimaEtapa ? (
                <button
                  type="button"
                  id="btn-concluir-tutorial"
                  className="btn btn-primary tutorial-botao-navegacao"
                  onClick={aoFinalizar}
                  autoFocus
                >
                  <i className="fa fa-check"></i> Concluir
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-proxima-etapa-tutorial"
                  className="btn btn-primary tutorial-botao-navegacao"
                  onClick={() => setEtapaAtual((atual) => atual + 1)}
                  autoFocus
                >
                  Próximo <i className="fas fa-chevron-right"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
