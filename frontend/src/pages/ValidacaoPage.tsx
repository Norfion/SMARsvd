import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState } from "react";
import type { LayoutCliente } from "../types/layout";
import type { ResultadoValidacaoCarne } from "../types/validacao";

interface ValidacaoPageProps {
  layoutsDisponiveis: LayoutCliente[];
}

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
  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoValidacaoCarne[]>([]);
  const [filtroApenasErros, setFiltroApenasErros] = useState(true);

  // Estado para controlar o Modal Informativo, de Confirmação e Senha
  const [modalInfo, setModalInfo] = useState<{
    aberto: boolean;
    tipo: TipoModalInformativo;
    titulo: string;
    mensagem: string;
    textoConfirmar?: string;
    exigeSenha?: boolean;
    valorSenha?: string;
    aoConfirmar?: () => void;
  }>({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  const exibirMensagem = (
    tipo: TipoModalInformativo,
    titulo: string,
    mensagem: string,
  ) => {
    setModalInfo({ aberto: true, tipo, titulo, mensagem });
  };

  const lidarComArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    if (
      arquivo.type !== "application/pdf" &&
      !arquivo.name.toLowerCase().endsWith(".pdf")
    ) {
      exibirMensagem(
        "erro",
        "Arquivo Inválido",
        "Por favor, selecione um arquivo válido no formato PDF.",
      );
      return;
    }

    setArquivo(arquivo);
    setResultados([]);
    exibirMensagem(
      "sucesso",
      "Arquivo Carregado",
      `Arquivo "${arquivo.name}" carregado com sucesso.`,
    );
  };
  const executarValidacao = () => {
    if (!layoutSelecionadoId) {
      exibirMensagem(
        "aviso",
        "Layout Obrigatório",
        "Selecione o modelo de layout para validar os documentos.",
      );
      return;
    }
    if (!arquivo) {
      exibirMensagem(
        "aviso",
        "Documento Pendente",
        "Faça o upload um arquivo PDF para validação primeiro.",
      );
      return;
    }

    setProcessando(true);
    setTimeout(() => {
      setResultados(MOCK_RESULTADOS);
      setProcessando(false);
    }, 1200);
  };

  const resultadosFiltrados = filtroApenasErros
    ? resultados.filter((item) => item.status === "Com Erro")
    : resultados;

  const totalComErro = resultados.filter((r) => r.status === "Com Erro").length;

  return (
    <div id="container-validacao-pdf">
      {/* TÍTULO E TOOLBAR DE AÇÕES SUPERIOR (Idêntico ao padrão da Imagem 2 de referência) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      ></div>

      {/* CARD DE IMPORTAÇÃO (Padrão de Card e Campos da Empresa) */}
      <section
        id="card-upload-parametrizacao"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #cfd8dc",
          borderRadius: "4px",
          overflow: "hidden",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            backgroundColor: "#e0f2f1",
            padding: "8px 14px",
            borderBottom: "1px solid #b2dfdb",
            fontWeight: 700,
            fontSize: "0.8rem",
            color: "#00796b",
            textTransform: "uppercase",
          }}
        >
          Importar documentos
        </div>

        <div style={{ padding: "14px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: "14px",
              alignItems: "flex-end",
            }}
          >
            {/* Seletor do Layout */}
            <div>
              <label
                htmlFor="select-layout-aplicado"
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Layout
              </label>
              <select
                id="select-layout-aplicado"
                value={layoutSelecionadoId}
                onChange={(e) => setLayoutSelecionadoId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                  color: "#263238",
                }}
              >
                <option value="">(Selecione um layout)</option>
                {layoutsDisponiveis.map((l) => (
                  <option key={l.nomeModelo} value={l.nomeModelo}>
                    {l.nomeModelo} ({l.cliente})
                  </option>
                ))}
              </select>
            </div>

            {/* Upload do Arquivo PDF */}
            <div>
              <span
                id="label-arquivo-pdf"
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Arquivo para validação
              </span>

              <input
                id="input-arquivo-pdf"
                type="file"
                accept="application/pdf"
                onChange={lidarComArquivo}
                style={{ display: "none" }}
              ></input>

              <label
                htmlFor="input-arquivo-pdf"
                id="btn-trigger-upload-pdf"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: arquivo ? "#e8f5e9" : "#ffffff",
                  border: arquivo ? "1px solid #81c784" : "1px solid #cfd8dc",
                  borderRadius: "4px",
                  padding: "0 10px",
                  cursor: "pointer",
                  height: "34px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ fontSize: "0.85rem" }}>
                    {arquivo ? "📄" : "📁"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: arquivo ? "#2e7d32" : "#78909c",
                      fontWeight: arquivo ? 700 : 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "200px",
                    }}
                  >
                    {arquivo ? arquivo.name : "Selecionar documento em PDF..."}
                  </span>
                </div>

                <span
                  style={{
                    backgroundColor: "#009688",
                    color: "#ffffff",
                    padding: "2px 8px",
                    borderRadius: "3px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                  }}
                >
                  Importar
                </span>
              </label>
            </div>

            {/* Botão de Disparo */}
            <button
              id="btn-executar-validacao"
              onClick={executarValidacao}
              disabled={processando}
              style={{
                backgroundColor: processando ? "#b0bec5" : "#009688",
                color: "#ffffff",
                border: "none",
                padding: "0 20px",
                borderRadius: "4px",
                fontWeight: 700,
                cursor: processando ? "not-allowed" : "pointer",
                height: "34px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              {processando ? "Auditando..." : "Validar"}
            </button>
          </div>
        </div>
      </section>

      {/* GRID / TABELA DE RESULTADOS (Reprodução fiel da Imagem 2) */}
      {resultados.length > 0 && (
        <section
          id="card-resultados-auditoria"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #cfd8dc",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#f5f7f8",
              borderBottom: "1px solid #cfd8dc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "0.85rem", color: "#263238" }}>
                Resultado da Auditoria
              </strong>
              <span
                style={{
                  backgroundColor: totalComErro > 0 ? "#ffebee" : "#e8f5e9",
                  color: totalComErro > 0 ? "#c62828" : "#2e7d32",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  border:
                    totalComErro > 0
                      ? "1px solid #ffcdd2"
                      : "1px solid #c8e6c9",
                }}
              >
                {totalComErro} documento com inconsistências
              </span>
            </div>

            {/* Switch Liga / Desliga para filtro de divergências */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
              onClick={() => setFiltroApenasErros(!filtroApenasErros)}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#455a64",
                  fontWeight: 600,
                  userSelect: "none",
                }}
              >
                Exibir apenas documentos com divergências
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={filtroApenasErros}
                onClick={(e) => {
                  e.stopPropagation();
                  setFiltroApenasErros(!filtroApenasErros);
                }}
                style={{
                  position: "relative",
                  width: "44px",
                  height: "22px",
                  borderRadius: "11px",
                  backgroundColor: filtroApenasErros ? "#009688" : "#b0bec5",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  transition: "background-color 0.2s ease",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    transform: filtroApenasErros
                      ? "translateX(22px)"
                      : "translateX(0px)",
                    transition: "transform 0.2s ease",
                  }}
                ></span>
              </button>
            </div>
          </div>

          <table
            id="tabela-carnes-auditados"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.8rem",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#009688",
                  color: "#ffffff",
                }}
              >
                <th
                  style={{
                    padding: "8px 10px",
                    fontWeight: 700,
                    width: "120px",
                  }}
                >
                  LOCALIZAÇÃO
                </th>
                <th
                  style={{
                    padding: "8px 10px",
                    fontWeight: 700,
                    textAlign: "center",
                    width: "120px",
                  }}
                >
                  SITUAÇÃO
                </th>
                <th style={{ padding: "8px 10px", fontWeight: 700 }}>
                  RESULTADO DA VALIDAÇÃO
                </th>
              </tr>
            </thead>
            <tbody>
              {resultadosFiltrados.map((item, idx) => (
                <tr
                  key={item.numeroDocumento}
                  style={{
                    borderBottom: "1px solid #eceff1",
                    backgroundColor:
                      idx % 2 === 0
                        ? "#ffffff"
                        : item.status === "Com Erro"
                          ? "#fff8f8"
                          : "#fbfcfc",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: 700,
                      color: "#37474f",
                    }}
                  >
                    Página {item.pagina}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "3px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        backgroundColor:
                          item.status === "Valido" ? "#e8f5e9" : "#ffebee",
                        color: item.status === "Valido" ? "#2e7d32" : "#c62828",
                        border:
                          item.status === "Valido"
                            ? "1px solid #c8e6c9"
                            : "1px solid #ffcdd2",
                      }}
                    >
                      {item.status === "Valido" ? "VÁLIDO" : "DIVERGENTE"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {item.erros.length === 0 ? (
                      <span
                        style={{
                          color: "#2e7d32",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Registros conformes as informações no banco de dados
                      </span>
                    ) : (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "14px",
                          color: "#c62828",
                          fontSize: "0.75rem",
                        }}
                      >
                        {item.erros.map((erro, eIdx) => (
                          <li key={eIdx} style={{ marginBottom: "2px" }}>
                            <strong>{erro.campo}:</strong> Extraído "
                            {erro.valorExtraido}" ≠ Esperado "
                            {erro.valorEsperado}" ({erro.mensagem})
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* RODAPÉ E PAGINAÇÃO (Idêntico ao padrão da Imagem 2) */}
          <div
            style={{
              padding: "8px 14px",
              backgroundColor: "#f5f7f8",
              borderTop: "1px solid #cfd8dc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.75rem",
              color: "#546e7a",
            }}
          >
            <div>
              Total de Registros: <strong>{resultados.length}</strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                disabled
                style={{
                  padding: "2px 6px",
                  borderRadius: "3px",
                  border: "1px solid #cfd8dc",
                  backgroundColor: "#ffffff",
                  color: "#b0bec5",
                  cursor: "not-allowed",
                }}
              >
                &lt;
              </button>
              <button
                type="button"
                style={{
                  padding: "2px 8px",
                  borderRadius: "3px",
                  border: "1px solid #009688",
                  backgroundColor: "#009688",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                1
              </button>
              <button
                type="button"
                disabled
                style={{
                  padding: "2px 6px",
                  borderRadius: "3px",
                  border: "1px solid #cfd8dc",
                  backgroundColor: "#ffffff",
                  color: "#b0bec5",
                  cursor: "not-allowed",
                }}
              >
                &gt;
              </button>
              <span style={{ marginLeft: "8px" }}>10 / página</span>
            </div>
          </div>
        </section>
      )}
      {/* Modal Informativo Centralizado */}
      <ModalInformativo
        aberto={modalInfo.aberto}
        tipo={modalInfo.tipo}
        titulo={modalInfo.titulo}
        mensagem={modalInfo.mensagem}
        textoConfirmar={modalInfo.textoConfirmar}
        exigeSenha={modalInfo.exigeSenha}
        valorSenha={modalInfo.valorSenha}
        aoMudarSenha={(novaSenha) =>
          setModalInfo((prev) => ({ ...prev, valorSenha: novaSenha }))
        }
        aoConfirmar={modalInfo.aoConfirmar}
        aoFechar={() =>
          setModalInfo((prev) => ({
            ...prev,
            aberto: false,
            exigeSenha: false,
            valorSenha: "",
          }))
        }
      ></ModalInformativo>
    </div>
  );
}
