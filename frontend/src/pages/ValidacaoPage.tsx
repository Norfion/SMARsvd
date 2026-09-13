import { useState } from "react";
import type { LayoutCliente } from "../types/layout";
import type { ResultadoValidacaoCarne } from "../types/validacao";

interface ValidacaoPageProps {
  layoutsDisponiveis: LayoutCliente[];
}

// Dados simulados baseados no carnê de Sertãozinho
const MOCK_RESULTADOS: ResultadoValidacaoCarne[] = [
  {
    numeroDocumento: "27480056",
    contribuinte: "JOSÉ RONICLAUDIO DE LIMA",
    pagina: 1,
    status: "Valido",
    erros: [],
  },
  {
    numeroDocumento: "27480059",
    contribuinte: "JOSÉ RONICLAUDIO DE LIMA",
    pagina: 2,
    status: "Com Erro",
    erros: [
      {
        campo: "Valor Total",
        valorExtraido: "R$ 119,38",
        valorEsperado: "R$ 125,00",
        mensagem: "Valor diverge do saldo devedor apurado no SQL Server.",
      },
      {
        campo: "Vencimento",
        valorExtraido: "15/09/2026",
        valorEsperado: "10/09/2026",
        mensagem: "Data de vencimento incompatível com o calendário fiscal.",
      },
    ],
  },
];

export function ValidacaoPage({ layoutsDisponiveis }: ValidacaoPageProps) {
  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>(
    layoutsDisponiveis[0]?.nomeModelo || "",
  );
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoValidacaoCarne[]>([]);
  const [filtroApenasErros, setFiltroApenasErros] = useState(true);

  const lidarComArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArquivo(e.target.files[0]);
    }
  };

  const executarValidacao = () => {
    if (!arquivo) {
      alert("Selecione um arquivo PDF de carnê primeiro.");
      return;
    }
    if (!layoutSelecionadoId) {
      alert("Selecione o layout que será utilizado na validação.");
      return;
    }

    setProcessando(true);
    // Simulação do tempo de resposta da API (.NET/RabbitMQ)
    setTimeout(() => {
      setResultados(MOCK_RESULTADOS);
      setProcessando(false);
    }, 1200);
  };

  const emitirRelatorioGeral = () => {
    window.print();
  };

  const resultadosFiltrados = filtroApenasErros
    ? resultados.filter((item) => item.status === "Com Erro")
    : resultados;

  const totalComErro = resultados.filter((r) => r.status === "Com Erro").length;

  return (
    <div
      id="container-validacao-pdf"
      style={{
        maxWidth: "1320px",
        margin: "0 auto",
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      {/* Bloco de Upload e Execução */}
      <section
        id="card-upload-parametrizacao"
        style={{
          backgroundColor: "#fff",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          id="titulo-sessao-importacao"
          style={{ fontSize: "1.1rem", color: "#0f172a", marginBottom: "16px" }}
        >
          Importação e Validação de Lote de Carnês
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: "16px",
            alignItems: "flex-end",
          }}
        >
          {/* Seletor de Layout */}
          <div>
            <label
              htmlFor="select-layout-aplicado"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "4px",
              }}
            >
              Layout de Validação Aplicável:
            </label>
            <select
              id="select-layout-aplicado"
              value={layoutSelecionadoId}
              onChange={(e) => setLayoutSelecionadoId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                height: "38px",
              }}
            >
              {layoutsDisponiveis.map((l) => (
                <option key={l.nomeModelo} value={l.nomeModelo}>
                  {l.nomeModelo} ({l.cliente})
                </option>
              ))}
            </select>
          </div>

          {/* Campo estilizado de Upload do PDF */}
          <div>
            <span
              id="label-arquivo-pdf"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "4px",
                color: "#1e293b",
              }}
            >
              Documento PDF:
            </span>

            {/* Input nativo oculto */}
            <input
              id="input-arquivo-pdf"
              type="file"
              accept="application/pdf"
              onChange={lidarComArquivo}
              style={{ display: "none" }}
            ></input>

            {/* Botão e visualizador acoplados à label */}
            <label
              htmlFor="input-arquivo-pdf"
              id="btn-trigger-upload-pdf"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: arquivo ? "#f0fdf4" : "#f8fafc",
                border: arquivo ? "1px solid #86efac" : "1px dashed #94a3b8",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                height: "38px",
                boxSizing: "border-box",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflow: "hidden",
                }}
              >
                <span style={{ fontSize: "1rem" }}>
                  {arquivo ? "📄" : "📁"}
                </span>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: arquivo ? "#15803d" : "#64748b",
                    fontWeight: arquivo ? 600 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "230px",
                  }}
                >
                  {arquivo ? arquivo.name : "Clique para selecionar o PDF..."}
                </span>
              </div>

              <span
                style={{
                  backgroundColor: arquivo ? "#dcfce7" : "#e2e8f0",
                  color: arquivo ? "#166534" : "#475569",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {arquivo ? "Alterar" : "Procurar"}
              </span>
            </label>
          </div>

          {/* Botão de Disparo */}
          <button
            id="btn-executar-validacao"
            onClick={executarValidacao}
            disabled={processando}
            style={{
              backgroundColor: processando ? "#94a3b8" : "#2563eb",
              color: "#fff",
              border: "none",
              padding: "10px 24px",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: processando ? "not-allowed" : "pointer",
              height: "38px",
            }}
          >
            {processando ? "Processando..." : "Validar Documentos"}
          </button>
        </div>
      </section>

      {/* Resultados da Validação */}
      {resultados.length > 0 && (
        <section
          id="card-resultados-auditoria"
          style={{
            backgroundColor: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "1.1rem", color: "#0f172a" }}>
                Resultado da Auditoria
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Total auditado: {resultados.length} | Com divergência:{" "}
                <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                  {totalComErro}
                </span>
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  color: "#334155",
                }}
              >
                <input
                  type="checkbox"
                  checked={filtroApenasErros}
                  onChange={(e) => setFiltroApenasErros(e.target.checked)}
                ></input>
                Exibir apenas carnês com inconsistências
              </label>

              <button
                id="btn-emitir-relatorio"
                onClick={emitirRelatorioGeral}
                style={{
                  backgroundColor: "#0f172a",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Emitir Relatório Geral
              </button>
            </div>
          </div>

          {/* Tabela de Carnês Auditados */}
          <table
            id="tabela-carnes-auditados"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#475569",
                }}
              >
                <th style={{ padding: "10px" }}>Página</th>
                <th style={{ padding: "10px" }}>Nº Documento</th>
                <th style={{ padding: "10px" }}>Contribuinte</th>
                <th style={{ padding: "10px" }}>Status</th>
                <th style={{ padding: "10px" }}>Detalhamento dos Problemas</th>
              </tr>
            </thead>
            <tbody>
              {resultadosFiltrados.map((item) => (
                <tr
                  key={item.numeroDocumento}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    backgroundColor:
                      item.status === "Com Erro" ? "#fff5f5" : "#ffffff",
                  }}
                >
                  <td
                    style={{
                      padding: "10px",
                      fontWeight: 700,
                      color: "#1e293b",
                    }}
                  >
                    Pág. {item.pagina}
                  </td>
                  <td style={{ padding: "10px", fontWeight: 600 }}>
                    {item.numeroDocumento}
                  </td>
                  <td style={{ padding: "10px" }}>{item.contribuinte}</td>
                  <td style={{ padding: "10px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        backgroundColor:
                          item.status === "Valido" ? "#dcfce7" : "#fee2e2",
                        color: item.status === "Valido" ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {item.status === "Valido" ? "Válido" : "Com Erro"}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>
                    {item.erros.length === 0 ? (
                      <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>
                        Conforme esperado no banco
                      </span>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "16px",
                          color: "#991b1b",
                          fontSize: "0.85rem",
                        }}
                      >
                        {item.erros.map((erro, idx) => (
                          <li key={idx} style={{ marginBottom: "4px" }}>
                            <strong>{erro.campo}:</strong> Extraído: "
                            {erro.valorExtraido}" | Esperado: "
                            {erro.valorEsperado}" — {erro.mensagem}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
