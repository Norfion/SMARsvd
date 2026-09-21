import type { LayoutCliente } from "./types/layout";
import type { ResultadoValidacaoLote } from "./types/validacao";
import { useState, useEffect } from "react";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";
import { ResultadoPage } from "./pages/ResultadoPage";
import { layoutService } from "./services/layoutService";
import { logService } from "./services/logService";
import { ErroConexaoPage } from "./pages/ErroConexaoPage";
import { ModalInformativo } from "./components/ModalInformativo";
import logoImg from "./assets/logo-smartb.png";

type AbaNavegacao = "parametrizacao" | "validacao" | "resultado";

export function App() {
  const [abaAtiva, setAbaAtiva] = useState<AbaNavegacao>("validacao");

  // Controla se o sistema está sem comunicação com o banco de dados
  const [erroConexaoBanco, setErroConexaoBanco] = useState<boolean>(false);

  // Estado para controlar o carregamento inicial dos dados do banco
  const [carregando, setCarregando] = useState<boolean>(true);

  // Estado para armazenar o resultado da última auditoria executada
  const [resultadoAuditoria, setResultadoAuditoria] =
    useState<ResultadoValidacaoLote | null>(null);

  const [layoutsSalvos, setLayoutsSalvos] = useState<LayoutCliente[]>([]);

  // Indica se a tela de parametrização possui dados alterados e não salvos
  const [
    temAlteracoesPendentesParametrizacao,
    setTemAlteracoesPendentesParametrizacao,
  ] = useState<boolean>(false);

  // Modal para confirmar saída de tela com alterações não salvas
  const [modalAvisoNavegacaoAberto, setModalAvisoNavegacaoAberto] =
    useState<boolean>(false);
  const [abaDestinoPendente, setAbaDestinoPendente] =
    useState<AbaNavegacao | null>(null);

  // Modal para informar a conclusão com sucesso da validação
  const [modalSucessoValidacaoAberto, setModalSucessoValidacaoAberto] =
    useState<boolean>(false);

  // Escuta os eventos emitidos pelo interceptador do Axios
  useEffect(() => {
    const lidarComStatusConexao = (event: Event) => {
      const customEvent = event as CustomEvent<{ semConexao: boolean }>;
      if (customEvent.detail) {
        setErroConexaoBanco(customEvent.detail.semConexao);
      }
    };

    window.addEventListener("eventoConexaoBanco", lidarComStatusConexao);
    return () =>
      window.removeEventListener("eventoConexaoBanco", lidarComStatusConexao);
  }, []);

  useEffect(() => {
    const capturarErroGlobal = (event: ErrorEvent) => {
      logService.registrarErro({
        tipo: "Exceção",
        mensagem: event.message,
        origem: "Window Error",
        stackTrace: event.error?.stack,
        detalhes: `Arquivo: ${event.filename} | Linha: ${event.lineno}`,
      });
    };

    window.addEventListener("error", capturarErroGlobal);
    return () => window.removeEventListener("error", capturarErroGlobal);
  }, []);

  // Carrega os layouts salvos no banco de dados ao iniciar a aplicação
  useEffect(() => {
    layoutService
      .listarTodos()
      .then((dados) => {
        if (dados && dados.length > 0) {
          setLayoutsSalvos(dados);
        }
        setErroConexaoBanco(false);
      })
      .catch((erro: unknown) => {
        console.error("Falha ao carregar layouts da API:", erro);
        setErroConexaoBanco(true);
      })
      .finally(() => {
        setCarregando(false);
      });
  }, []);

  // Centraliza o salvamento de layouts no backend
  const lidarComSalvarLayouts = async (novosLayouts: LayoutCliente[]) => {
    setLayoutsSalvos(novosLayouts);

    const layoutParaSalvar =
      novosLayouts.find((novo) => {
        const anterior = layoutsSalvos.find(
          (l) => l.nomeModelo === novo.nomeModelo,
        );
        return !anterior || JSON.stringify(anterior) !== JSON.stringify(novo);
      }) || novosLayouts[novosLayouts.length - 1];

    if (!layoutParaSalvar) return;

    try {
      await layoutService.salvar(layoutParaSalvar);
      const dadosAtualizados = await layoutService.listarTodos();
      if (dadosAtualizados && dadosAtualizados.length > 0) {
        setLayoutsSalvos(dadosAtualizados);
      }
    } catch (erro: unknown) {
      console.error("Erro ao persistir o layout no banco de dados:", erro);
    }
  };

  const lidarComExcluirLayout = async (idParaExcluir: string) => {
    try {
      await layoutService.excluir(idParaExcluir);
      const listaAtualizada = await layoutService.listarTodos();
      setLayoutsSalvos(listaAtualizada);
    } catch (erro) {
      console.error("Erro ao excluir o layout:", erro);
    }
  };

  // Recebe o resultado da auditoria, direciona para a aba Resultado e abre o modal de sucesso
  const lidarComConclusaoValidacao = (resultado: ResultadoValidacaoLote) => {
    setResultadoAuditoria(resultado);
    setAbaAtiva("resultado");
    setModalSucessoValidacaoAberto(true);
  };

  // Controla a troca de abas com interceptação de alterações não salvas
  const tentarMudarAba = (novaAba: AbaNavegacao) => {
    if (abaAtiva === novaAba) return;

    // Se estiver na aba parametrização e houver alterações não salvas, bloqueia e avisa
    if (abaAtiva === "parametrizacao" && temAlteracoesPendentesParametrizacao) {
      setAbaDestinoPendente(novaAba);
      setModalAvisoNavegacaoAberto(true);
      return;
    }

    setAbaAtiva(novaAba);
  };

  // Caso o usuário confirme a perda das alterações para ir para outra aba
  const confirmarNavegacaoSemSalvar = () => {
    if (abaDestinoPendente) {
      setTemAlteracoesPendentesParametrizacao(false);
      setAbaAtiva(abaDestinoPendente);
      setAbaDestinoPendente(null);
    }
    setModalAvisoNavegacaoAberto(false);
  };

  if (erroConexaoBanco) {
    return <ErroConexaoPage></ErroConexaoPage>;
  }

  return (
    <div
      id="root-app"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f0f2f5",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <style>
        {`
          @keyframes animacaoGiroSpinner {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}
      </style>

      {/* BLOQUEIO DE TELA / COMPONENTE DE CARREGAMENTO */}
      {carregando && (
        <div
          id="overlay-bloqueio-carregamento"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "wait",
            userSelect: "none",
          }}
        >
          <div
            id="card-status-carregamento"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #cfd8dc",
              borderRadius: "8px",
              padding: "24px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.12)",
              maxWidth: "360px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "4px solid #e0f2f1",
                borderTop: "4px solid #00796b",
                animation: "animacaoGiroSpinner 0.85s linear infinite",
              }}
            ></div>

            <div>
              <strong
                style={{
                  display: "block",
                  color: "#00796b",
                  fontSize: "0.95rem",
                  marginBottom: "4px",
                  fontWeight: 700,
                }}
              >
                Carregando...
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* CABEÇALHO SUPERIOR CORPORATIVO */}
      <header
        id="cabecalho-principal-empresa"
        style={{
          backgroundColor: "#ffffff",
          height: "48px",
          borderBottom: "1px solid #cfd8dc",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
            }}
          >
            <img
              src={logoImg}
              alt="Logotipo Institucional"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            ></img>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#00796b",
                letterSpacing: "0.5px",
              }}
            >
              SVD
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#78909c",
                fontWeight: 600,
              }}
            >
              | Sistema de Validação de Documentos
            </span>
          </div>
        </div>
      </header>

      {/* FITA DE NAVEGAÇÃO / BREADCRUMB: Configurações > Validação > Resultado */}
      <div
        id="barra-navegacao-fitas"
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #cfd8dc",
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {/* Aba 1: Configurações */}
          <button
            type="button"
            onClick={() => tentarMudarAba("parametrizacao")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "3px",
              border:
                abaAtiva === "parametrizacao"
                  ? "1px solid #009688"
                  : "1px solid #cfd8dc",
              backgroundColor:
                abaAtiva === "parametrizacao" ? "#e0f2f1" : "#f8fafc",
              color: abaAtiva === "parametrizacao" ? "#00796b" : "#455a64",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <span>Configurações</span>
          </button>

          <span
            style={{
              color: "#b0bec5",
              fontSize: "1.6rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ›
          </span>

          {/* Aba 2: Validação */}
          <button
            type="button"
            onClick={() => tentarMudarAba("validacao")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "3px",
              border:
                abaAtiva === "validacao"
                  ? "1px solid #009688"
                  : "1px solid #cfd8dc",
              backgroundColor: abaAtiva === "validacao" ? "#e0f2f1" : "#f8fafc",
              color: abaAtiva === "validacao" ? "#00796b" : "#455a64",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <span>Validação</span>
          </button>

          <span
            style={{
              color: "#b0bec5",
              fontSize: "1.6rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ›
          </span>

          {/* Aba 3: Resultado */}
          <button
            type="button"
            onClick={() => tentarMudarAba("resultado")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "3px",
              border:
                abaAtiva === "resultado"
                  ? "1px solid #009688"
                  : "1px solid #cfd8dc",
              backgroundColor: abaAtiva === "resultado" ? "#e0f2f1" : "#f8fafc",
              color: abaAtiva === "resultado" ? "#00796b" : "#455a64",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <span>Resultado</span>
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL DO CONTEÚDO */}
      <main
        id="conteudo-tela-ativa"
        style={{
          flex: 1,
          padding: "16px",
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {abaAtiva === "parametrizacao" && (
          <ParametrizacaoPage
            layoutsSalvos={layoutsSalvos}
            onSalvarLayouts={lidarComSalvarLayouts}
            onExcluirLayout={lidarComExcluirLayout}
            onHouveAlteracaoChange={setTemAlteracoesPendentesParametrizacao}
          ></ParametrizacaoPage>
        )}

        {abaAtiva === "validacao" && (
          <ValidacaoPage
            layoutsDisponiveis={layoutsSalvos}
            onConcluirValidacao={lidarComConclusaoValidacao}
          ></ValidacaoPage>
        )}

        {abaAtiva === "resultado" && (
          <ResultadoPage
            resultadoAuditoria={resultadoAuditoria}
            onIrParaValidacao={() => setAbaAtiva("validacao")}
          ></ResultadoPage>
        )}
      </main>

      {/* MODAL DE CONFIRMAÇÃO PARA ALTERAÇÕES NÃO SALVAS */}
      <ModalInformativo
        aberto={modalAvisoNavegacaoAberto}
        tipo="confirmacao"
        titulo="Alterações Pendentes"
        mensagem={`Existem alterações feitas no layout que não foram salvas. Essas alterações poderão ser perdidas.\n\nDeseja realmente continuar?`}
        textoConfirmar="Continuar"
        aoConfirmar={confirmarNavegacaoSemSalvar}
        aoFechar={() => {
          setModalAvisoNavegacaoAberto(false);
          setAbaDestinoPendente(null);
        }}
      ></ModalInformativo>

      {/* MODAL DE SUCESSO AO CONCLUIR VALIDAÇÃO */}
      <ModalInformativo
        aberto={modalSucessoValidacaoAberto}
        tipo="sucesso"
        titulo="Validação Concluída"
        mensagem={`A auditoria do arquivo foi finalizada.`}
        textoConfirmar="OK"
        aoFechar={() => setModalSucessoValidacaoAberto(false)}
      ></ModalInformativo>
    </div>
  );
}

export default App;
