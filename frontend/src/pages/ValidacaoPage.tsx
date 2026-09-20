import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState } from "react";
import type { LayoutCliente } from "../types/layout";
import type {
  ResultadoValidacaoCarne,
  ResultadoValidacaoLote,
} from "../types/validacao";

interface ValidacaoPageProps {
  layoutsDisponiveis: LayoutCliente[];
  onConcluirValidacao: (resultado: ResultadoValidacaoLote) => void;
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

export function ValidacaoPage({
  layoutsDisponiveis,
  onConcluirValidacao,
}: ValidacaoPageProps) {
  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);

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
    const arquivoSelecionado = e.target.files?.[0];
    if (!arquivoSelecionado) return;

    if (
      arquivoSelecionado.type !== "application/pdf" &&
      !arquivoSelecionado.name.toLowerCase().endsWith(".pdf")
    ) {
      exibirMensagem(
        "erro",
        "Arquivo Inválido",
        "Por favor, selecione um arquivo válido no formato PDF.",
      );
      return;
    }

    setArquivo(arquivoSelecionado);
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
        "Faça o upload de um arquivo PDF para validação primeiro.",
      );
      return;
    }

    setProcessando(true);

    setTimeout(() => {
      setProcessando(false);

      // Agrupa todas as inconsistências individuais para o relatório do lote
      const inconsistenciasDetalhadas = MOCK_RESULTADOS.flatMap((item) =>
        item.erros.map((erro) => ({
          identificadorGuia: `Página ${item.pagina}`,
          campo: erro.campo,
          valorExtraidoPdf: erro.valorExtraido,
          valorEsperadoBanco: erro.valorEsperado,
          mensagem: erro.mensagem,
        })),
      );

      const totalGuias = MOCK_RESULTADOS.length;
      const guiasComErro = MOCK_RESULTADOS.filter(
        (r) => r.status === "Com Erro",
      ).length;
      const guiasValidas = totalGuias - guiasComErro;

      const resultadoConsolidado: ResultadoValidacaoLote = {
        nomeArquivo: arquivo.name,
        layoutUtilizado: layoutSelecionadoId,
        totalGuiasAnalisadas: totalGuias,
        guiasValidas: guiasValidas,
        guiasComInconsistencia: guiasComErro,
        inconsistencias: inconsistenciasDetalhadas,
      };

      // Notifica o App para registrar os dados e alternar para a aba "Resultado"
      onConcluirValidacao(resultadoConsolidado);
    }, 1200);
  };

  return (
    <div id="container-validacao-pdf">
      {/* CARD DE IMPORTAÇÃO */}
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
