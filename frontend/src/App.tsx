import { useState, useEffect } from "react";
import type { LayoutCliente } from "./types/layout";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";
import { layoutService } from "./services/layoutService";

export function App() {
  const [abaAtiva, setAbaAtiva] = useState<"parametrizacao" | "validacao">(
    "validacao",
  );

  const [layoutsSalvos, setLayoutsSalvos] = useState<LayoutCliente[]>([
    {
      cliente: "PM Sertãozinho - SP",
      nomeModelo: "Carnê Geral 2026 - Padrão",
      versao: 1,
      orientacao: "Paisagem",
      formatoPapel: "Personalizado",
      larguraPaginaMm: 70,
      alturaPaginaMm: 30,
      quantidadePaginasPadrao: 1,
      campos: [],
      queriesValidacao: [],
    },
  ]);

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
          {/* Brasão / Logotipo Institucional */}
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "4px",
              backgroundColor: "#e0f2f1",
              border: "1px solid #009688",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
            }}
          >
            🏛️
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
              SMARrsvd
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

      {/* FITA DE NAVEGAÇÃO / BREADCRUMB (Idêntico ao padrão dos sistemas de referência) */}
      <div
        id="barra-navegacao-fitas"
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #cfd8dc",
          padding: "6px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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

          <span style={{ color: "#b0bec5", fontSize: "0.8rem" }}>›</span>

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
        {abaAtiva === "parametrizacao" ? (
          <ParametrizacaoPage
            layoutsSalvos={layoutsSalvos}
            onSalvarLayouts={setLayoutsSalvos}
          ></ParametrizacaoPage>
        ) : (
          <ValidacaoPage layoutsDisponiveis={layoutsSalvos}></ValidacaoPage>
        )}
      </main>
    </div>
  );
}

export default App;
