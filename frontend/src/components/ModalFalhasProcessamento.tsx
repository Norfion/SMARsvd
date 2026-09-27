import { useMemo } from "react";
import type { FalhaProcessamentoItem } from "../types/validacao";

interface ModalFalhasProcessamentoProps {
  aberto: boolean;
  falhas: FalhaProcessamentoItem[];
  aoFechar: () => void;
}

interface GrupoFalha {
  chave: string;
  origem: string;
  tipo: string;
  mensagem: string;
  nomeQuery: string | null;
  paginas: string[];
  detalhes: string | null;
  datasHora: string[];
}

function agruparFalhas(falhas: FalhaProcessamentoItem[]): GrupoFalha[] {
  const grupos = new Map<string, GrupoFalha>();

  falhas.forEach((falha) => {
    const origem = falha.Origem ?? falha.origem ?? "Processo de validação";
    const tipo = falha.Tipo ?? falha.tipo ?? "Erro";
    const mensagem = falha.Mensagem ?? falha.mensagem ?? "Falha desconhecida.";
    const nomeQuery = falha.NomeQuery ?? falha.nomeQuery ?? null;
    const paginaInicio = falha.PaginaInicio ?? falha.paginaInicio;
    const paginaFim = falha.PaginaFim ?? falha.paginaFim;
    const detalhes = falha.Detalhes ?? falha.detalhes ?? null;
    const dataHora = falha.DataHora ?? falha.dataHora ?? null;

    const chave = `${origem}|${tipo}|${nomeQuery ?? ""}|${mensagem}`;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        chave,
        origem,
        tipo,
        mensagem,
        nomeQuery,
        paginas: [],
        detalhes,
        datasHora: [],
      };
      grupos.set(chave, grupo);
    }

    if (paginaInicio) {
      grupo.paginas.push(
        paginaFim && paginaFim !== paginaInicio
          ? `${paginaInicio}–${paginaFim}`
          : `${paginaInicio}`,
      );
    }
    if (dataHora) grupo.datasHora.push(dataHora);
  });

  return Array.from(grupos.values());
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  return isNaN(data.getTime()) ? iso : data.toLocaleString("pt-BR");
}

export function ModalFalhasProcessamento({
  aberto,
  falhas,
  aoFechar,
}: ModalFalhasProcessamentoProps) {
  const grupos = useMemo(() => agruparFalhas(falhas), [falhas]);

  if (!aberto) return null;

  return (
    <div
      id="modal-falhas-processamento"
      onClick={aoFechar}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(1px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "4px",
          border: "1px solid #cfd8dc",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          width: "90%",
          maxWidth: "760px",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            backgroundColor: "#ffebee",
            borderBottom: "1px solid #ffcdd2",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "#c62828",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.85rem",
              fontWeight: 800,
            }}
          >
            <span>!</span>
          </div>
          <strong style={{ color: "#c62828", fontSize: "0.95rem" }}>
            Falhas durante a validação
          </strong>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              color: "#b71c1c",
              fontWeight: 600,
            }}
          >
            {falhas.length} ocorrência(s) em {grupos.length} tipo(s) de falha
          </span>
        </div>

        {/* Corpo */}
        <div
          style={{
            padding: "14px 16px",
            color: "#37474f",
            fontSize: "0.85rem",
            lineHeight: 1.5,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {grupos.map((grupo) => (
            <div
              key={grupo.chave}
              style={{
                border: "1px solid #ffcdd2",
                borderLeft: "4px solid #c62828",
                borderRadius: "4px",
                padding: "10px 12px",
                backgroundColor: "#fffafa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    backgroundColor: "#c62828",
                    color: "#ffffff",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "3px",
                    textTransform: "uppercase",
                  }}
                >
                  {grupo.tipo}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#546e7a",
                  }}
                >
                  {grupo.origem}
                </span>
                {grupo.paginas.length > 1 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "#b71c1c",
                    }}
                  >
                    {grupo.paginas.length} documentos afetados
                  </span>
                )}
              </div>

              <p
                style={{
                  margin: "0 0 6px 0",
                  fontWeight: 600,
                  color: "#b71c1c",
                  wordBreak: "break-word",
                }}
              >
                {grupo.mensagem}
              </p>

              {grupo.nomeQuery && (
                <div style={{ fontSize: "0.78rem" }}>
                  Query: <strong>{grupo.nomeQuery}</strong>
                </div>
              )}

              {grupo.paginas.length > 0 && (
                <div
                  style={{
                    fontSize: "0.78rem",
                    maxHeight: "72px",
                    overflowY: "auto",
                    wordBreak: "break-word",
                  }}
                >
                  Páginas: <strong>{grupo.paginas.join(", ")}</strong>
                </div>
              )}

              {grupo.datasHora.length > 0 && (
                <div style={{ fontSize: "0.78rem" }}>
                  Registrado em:{" "}
                  <strong>
                    {grupo.datasHora.map(formatarDataHora).join(", ")}
                  </strong>
                </div>
              )}

              {grupo.detalhes && (
                <details style={{ marginTop: "6px" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#546e7a",
                    }}
                  >
                    {grupo.nomeQuery
                      ? grupo.paginas.length > 1
                        ? "Ver SQL executado (exemplo do primeiro documento)"
                        : "Ver SQL executado"
                      : "Ver detalhes"}
                  </summary>
                  <pre
                    style={{
                      margin: "6px 0 0 0",
                      padding: "8px 10px",
                      backgroundColor: "#f5f7f8",
                      border: "1px solid #eceff1",
                      borderRadius: "3px",
                      fontSize: "0.72rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {grupo.detalhes}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div
          style={{
            padding: "10px 16px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #eceff1",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={aoFechar}
            style={{
              backgroundColor: "#c62828",
              color: "#ffffff",
              border: "none",
              padding: "6px 18px",
              borderRadius: "4px",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            <span>Fechar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalFalhasProcessamento;
