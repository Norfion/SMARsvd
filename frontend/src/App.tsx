import { useState } from "react";
import type { LayoutCliente } from "./types/layout";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";

export function App() {
  // Estado que guarda qual tela está visível no momento
  const [abaAtiva, setAbaAtiva] = useState<"parametrizacao" | "validacao">(
    "validacao",
  );

  // Lista de layouts mantida na raiz para que a tela de Validação enxergue o que foi salvo na tela de Parametrização
  const [layoutsSalvos, setLayoutsSalvos] = useState<LayoutCliente[]>([
    {
      cliente: "PM Sertãozinho - SP",
      nomeModelo: "Carnê Geral 2026 - Padrão",
      versao: 1,
      orientacao: "Paisagem",
      formatoPapel: "Personalizado",
      larguraPaginaMm: 70,
      alturaPaginaMm: 30,
      campos: [],
    },
  ]);

  return (
    <div
      id="root-app"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        padding: "20px",
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      {/* Barra de Navegação no Topo */}
      <nav
        id="barra-navegacao-global"
        style={{
          maxWidth: "1320px",
          margin: "0 auto 20px auto",
          backgroundColor: "#ffffff",
          padding: "12px 20px",
          borderRadius: "8px",
          border: "1px solid #cbd5e1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.2rem" }}>
          SMARrsvp
        </div>

        {/* Botões para trocar de tela */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            id="btn-aba-validacao"
            type="button"
            onClick={() => setAbaAtiva("validacao")}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              backgroundColor: abaAtiva === "validacao" ? "#2563eb" : "#f1f5f9",
              color: abaAtiva === "validacao" ? "#ffffff" : "#475569",
              transition: "all 0.2s ease",
            }}
          >
            1. Importação
          </button>

          <button
            id="btn-aba-parametrizacao"
            type="button"
            onClick={() => setAbaAtiva("parametrizacao")}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              backgroundColor:
                abaAtiva === "parametrizacao" ? "#2563eb" : "#f1f5f9",
              color: abaAtiva === "parametrizacao" ? "#ffffff" : "#475569",
              transition: "all 0.2s ease",
            }}
          >
            2. Layout
          </button>
        </div>
      </nav>

      {/* Exibição condicional da tela selecionada */}
      <main id="conteudo-tela-ativa">
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
