import type { LayoutCliente } from "./types/layout";
import type { ResultadoValidacaoLote } from "./types/validacao";
import { useState, useEffect } from "react";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";
import { ResultadoPage } from "./pages/ResultadoPage";
import { layoutService } from "./services/layoutService";
import { logService } from "./services/logService";
import { ErroConexaoPage } from "./pages/ErroConexaoPage";
import logoImg from "./assets/logo-smartb.png";

export function App() {
  const [abaAtiva, setAbaAtiva] = useState<
    "parametrizacao" | "validacao" | "resultado"
  >("validacao");

  // Controla se o sistema está sem comunicação com o banco de dados
  const [erroConexaoBanco, setErroConexaoBanco] = useState<boolean>(false);

  // Estado para controlar o carregamento inicial dos dados do banco
  const [carregando, setCarregando] = useState<boolean>(true);

  // Estado para armazenar o resultado da última auditoria executada
  const [resultadoAuditoria, setResultadoAuditoria] =
    useState<ResultadoValidacaoLote | null>(null);

  const [layoutsSalvos, setLayoutsSalvos] = useState<LayoutCliente[]>([]);

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
        // Garante que se o banco falhar na largada, a tela de erro seja apresentada
        setErroConexaoBanco(true);
      })
      .finally(() => {
        // Libera o spinner inicial
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
      alert(
        "Atenção: Os dados foram alterados na tela, mas ocorreu um erro ao gravar no banco de dados. Verifique se o backend está ativo.",
      );
    }
  };

  const lidarComExcluirLayout = async (idParaExcluir: string) => {
    try {
      // Aciona o backend: rota DELETE /api/layouts/{id}
      await layoutService.excluir(idParaExcluir);

      // Sincroniza a tela consultando o banco recém atualizado
      const listaAtualizada = await layoutService.listarTodos();
      setLayoutsSalvos(listaAtualizada);
    } catch (erro) {
      console.error("Erro ao excluir o layout:", erro);
      alert("Falha ao comunicar com o banco de dados para exclusão.");
    }
  };

  // Recebe o resultado da auditoria e direciona automaticamente para a aba Resultado
  const lidarComConclusaoValidacao = (resultado: ResultadoValidacaoLote) => {
    setResultadoAuditoria(resultado);
    setAbaAtiva("resultado");
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
            {/* Círculo indicador / Spinner em verde-petróleo */}
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
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#546e7a",
                  lineHeight: 1.4,
                }}
              >
                Sincronizando com o banco de dados.
              </span>
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
            onClick={() => setAbaAtiva("parametrizacao")}
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
            onClick={() => setAbaAtiva("validacao")}
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
            onClick={() => setAbaAtiva("resultado")}
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
    </div>
  );
}

export default App;
