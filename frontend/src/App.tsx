import { useState, useEffect } from "react";
import type { LayoutCliente } from "./types/layout";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";
import { layoutService } from "./services/layoutService";
import logoImg from "./assets/logo-smartb.png";

export function App() {
  const [abaAtiva, setAbaAtiva] = useState<"parametrizacao" | "validacao">(
    "validacao",
  );

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

  // Função para excluir fisicamente o layout no banco e na tela
  const lidarComExcluirLayout = async (idOuNome: string) => {
    const layoutParaRemover = layoutsSalvos.find(
      (l) => l.id === idOuNome || l.nomeModelo === idOuNome,
    );

    if (!layoutParaRemover) return;

    try {
      // Se o layout possuir ID registrado no banco, chama a API
      if (layoutParaRemover.id) {
        await layoutService.excluir(layoutParaRemover.id);
      }

      // Remove da memória do React
      setLayoutsSalvos((anteriores) =>
        anteriores.filter((l) => l.nomeModelo !== layoutParaRemover.nomeModelo),
      );
    } catch (erro: unknown) {
      console.error("Erro ao excluir layout do banco de dados:", erro);
      alert("Erro ao excluir o layout no banco de dados. Verifique a API.");
    }
  };

  // Função centralizada para salvar e persistir os layouts no banco de dados
  const lidarComSalvarLayouts = async (novosLayouts: LayoutCliente[]) => {
    // 1. Atualiza o estado no React para refletir instantaneamente na tela
    setLayoutsSalvos(novosLayouts);

    // 2. Identifica qual layout foi adicionado ou alterado em relação à lista anterior
    const layoutParaSalvar =
      novosLayouts.find((novo) => {
        const anterior = layoutsSalvos.find(
          (l) => l.nomeModelo === novo.nomeModelo,
        );
        return !anterior || JSON.stringify(anterior) !== JSON.stringify(novo);
      }) || novosLayouts[novosLayouts.length - 1];

    if (!layoutParaSalvar) return;

    try {
      // 3. Dispara a requisição HTTP POST para a API em .NET
      await layoutService.salvar(layoutParaSalvar);

      // 4. Recarrega os dados do banco para sincronizar os IDs gerados pelo backend
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

      {/* FITA DE NAVEGAÇÃO / BREADCRUMB */}
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

          {/* Separador centralizado verticalmente */}
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
            onSalvarLayouts={lidarComSalvarLayouts}
            onExcluirLayout={lidarComExcluirLayout}
          ></ParametrizacaoPage>
        ) : (
          <ValidacaoPage layoutsDisponiveis={layoutsSalvos}></ValidacaoPage>
        )}
      </main>
    </div>
  );
}

export default App;
