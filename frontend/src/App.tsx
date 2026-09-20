import { useState, useEffect } from "react";
import type { LayoutCliente } from "./types/layout";
import type { ResultadoValidacaoLote } from "./types/validacao";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";
import { ResultadoPage } from "./pages/ResultadoPage";
import { layoutService } from "./services/layoutService";
import logoImg from "./assets/logo-smartb.png";

export function App() {
  const [abaAtiva, setAbaAtiva] = useState<
    "parametrizacao" | "validacao" | "resultado"
  >("validacao");

  // Estado para armazenar o resultado da última auditoria executada
  const [resultadoAuditoria, setResultadoAuditoria] =
    useState<ResultadoValidacaoLote | null>(null);

  const [layoutsSalvos, setLayoutsSalvos] = useState<LayoutCliente[]>([]);

  // Carrega os layouts salvos no banco de dados ao iniciar a aplicação
  useEffect(() => {
    layoutService
      .listarTodos()
      .then((dados) => {
        if (dados && dados.length > 0) {
          setLayoutsSalvos(dados);
        }
      })
      .catch((erro: unknown) => {
        console.error("Falha ao carregar layouts da API:", erro);
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

  return (
    <div
      id="root-app"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f0f2f5",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
