import { processamentoService } from "../services/processamentoService";
import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState, useRef } from "react";
import type { LayoutCliente } from "../types/layout";
import type {
  InconsistenciaItem,
  ResultadoValidacaoLote,
} from "../types/validacao";

interface ValidacaoPageProps {
  layoutsDisponiveis: LayoutCliente[];
  onConcluirValidacao: (resultado: ResultadoValidacaoLote) => void;
}

export function ValidacaoPage({
  layoutsDisponiveis,
  onConcluirValidacao,
}: ValidacaoPageProps) {
  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState<boolean>(false);

  // Controle da etapa atual de processamento (0 = inativo, 1 = extração, 2 = banco, 3 = validação)
  const [etapaAtual, setEtapaAtual] = useState<number>(0);

  // Textos descritivos para cada etapa de execução
  const descricoesEtapas: Record<number, string> = {
    1: "Extraindo dados do arquivo...",
    2: "Buscando informações no banco de dados...",
    3: "Aplicando regras para validação...",
  };

  // Estados para validação integral vs amostragem
  const [validarIntegralmente, setValidarIntegralmente] =
    useState<boolean>(true);
  const [percentualAmostragem, setPercentualAmostragem] = useState<number>(100);

  // Referência direta para focar e selecionar o input de amostragem
  const inputAmostragemRef = useRef<HTMLInputElement | null>(null);

  // Alterna o botão Liga/Desliga
  const alternarModoValidacao = () => {
    const novoModoIntegral = !validarIntegralmente;
    setValidarIntegralmente(novoModoIntegral);

    if (novoModoIntegral) {
      setPercentualAmostragem(100);
    } else {
      setPercentualAmostragem(30);

      setTimeout(() => {
        if (inputAmostragemRef.current) {
          inputAmostragemRef.current.focus();
          inputAmostragemRef.current.select();
        }
      }, 50);
    }
  };

  // Trata a alteração manual do percentual garantindo intervalo de 0 a 100
  const lidarComMudancaPercentual = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const valor = Number(e.target.value);
    if (isNaN(valor)) return;
    const valorLimitado = Math.min(100, Math.max(0, valor));
    setPercentualAmostragem(valorLimitado);
    if (valorLimitado === 100) {
      setValidarIntegralmente(true);
    }
  };

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

  const executarValidacao = async () => {
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

    // Identifica o ID real (GUID) do layout selecionado no select
    const layoutEncontrado = layoutsDisponiveis.find(
      (l) => l.nomeModelo === layoutSelecionadoId,
    );

    if (!layoutEncontrado?.id) {
      exibirMensagem(
        "erro",
        "Layout Não Identificado",
        "Não foi possível obter o identificador do layout. Certifique-se de salvá-lo no banco primeiro.",
      );
      return;
    }

    setProcessando(true);

    try {
      // ETAPA 1/3: Extrair dados do arquivo PDF
      setEtapaAtual(1);
      const respostaExtracao = await processamentoService.extrair(
        arquivo,
        layoutEncontrado.id,
        percentualAmostragem ?? 100,
      );

      // ETAPA 2/3: Buscar dados no banco de dados
      setEtapaAtual(2);
      await processamentoService.buscarBanco(layoutEncontrado.id);

      // ETAPA 3/3: Aplicar regras de validação
      setEtapaAtual(3);
      const utilizouOcr = Boolean(respostaExtracao?.extracao?.usouOcr);
      const dadosApi = await processamentoService.validarRegras(
        layoutEncontrado.id,
        arquivo.name,
        utilizouOcr,
      );

      // Normaliza a lista de inconsistências recebida do backend suportando os novos nomes
      const listaRecebida =
        dadosApi.Inconsistencias ?? dadosApi.inconsistencias ?? [];
      const divergenciasNormalizadas: InconsistenciaItem[] = listaRecebida.map(
        (item) => ({
          paginaExtraido: item.PaginaExtraido ?? item.paginaExtraido,
          campo: item.Campo ?? item.campo ?? "—",
          valorExtraidoPdf:
            item.ValorExtraidoPdf ?? item.valorExtraidoPdf ?? "—",
          valorEsperadoBanco:
            item.ValorEsperadoBanco ?? item.valorEsperadoBanco ?? "—",
          mensagemAuditoria:
            item.MensagemAuditoria ??
            item.mensagemAuditoria ??
            item.Mensagem ??
            item.mensagem ??
            "Divergência detectada",
        }),
      );

      // Captura com segurança os totalizadores da auditoria (suporte aos novos nomes e aos legados)
      const totalDocs =
        dadosApi.TotalDocumentosAnalisados ??
        dadosApi.totalDocumentosAnalisados ??
        0;

      const documentosInconsistentes =
        dadosApi.DocumentosComInconsistencia ??
        dadosApi.documentosComInconsistencia ??
        divergenciasNormalizadas.length;

      const documentosValidos =
        dadosApi.DocumentosValidos ??
        dadosApi.documentosValidos ??
        Math.max(0, totalDocs - documentosInconsistentes);

      // Monta o objeto completo compatível com a tela de resultado
      const resultadoConsolidado: ResultadoValidacaoLote = {
        nomeArquivo:
          dadosApi.NomeArquivo ?? dadosApi.nomeArquivo ?? arquivo.name,
        layoutUtilizado:
          dadosApi.LayoutUtilizado ??
          dadosApi.layoutUtilizado ??
          layoutEncontrado.nomeModelo,
        totalDocumentosAnalisados: totalDocs,
        documentosValidos: documentosValidos,
        documentosComInconsistencia: documentosInconsistentes,
        inconsistencias: divergenciasNormalizadas,
        validacoes: dadosApi.Validacoes ?? dadosApi.validacoes ?? [],
        amostragem:
          dadosApi.Amostragem ??
          dadosApi.amostragem ??
          percentualAmostragem ??
          100,
        usouOcr: dadosApi.UsouOcr ?? dadosApi.usouOcr ?? utilizouOcr,
      };

      // Notifica e redireciona para a aba "Resultado"
      onConcluirValidacao(resultadoConsolidado);
    } catch (erro: unknown) {
      console.error("Erro ao validar o lote de documentos:", erro);
      exibirMensagem(
        "erro",
        "Falha na Validação",
        "Ocorreu um erro ao processar as etapas no backend. Verifique se o servidor está ativo.",
      );
    } finally {
      setProcessando(false);
      setEtapaAtual(0);
    }
  };

  return (
    <div id="container-validacao-pdf" style={{ position: "relative" }}>
      {/* Remove os controles de spin do number e define a animação de rotação */}
      <style>
        {`
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
            appearance: textfield;
          }
          @keyframes animacaoGiroSpinnerValidacao {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}
      </style>

      {/* BLOQUEIO DE TELA / INDICADOR DA ETAPA EM EXECUÇÃO */}
      {processando && (
        <div
          id="overlay-bloqueio-processamento"
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
            id="card-status-processamento"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #cfd8dc",
              borderRadius: "8px",
              padding: "24px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.12)",
              minWidth: "320px",
              maxWidth: "400px",
            }}
          >
            {/* Spinner animado */}
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "4px solid #e0f2f1",
                borderTop: "4px solid #00796b",
                animation: "animacaoGiroSpinnerValidacao 0.85s linear infinite",
              }}
            ></div>

            <div style={{ width: "100%", textAlign: "center" }}>
              <strong
                style={{
                  display: "block",
                  color: "#00796b",
                  fontSize: "1rem",
                  marginBottom: "10px",
                  fontWeight: 700,
                }}
              >
                Validando Documentos
              </strong>

              {/* Indicador individual da etapa em andamento */}
              <div
                id="etapa-corrente-processamento"
                style={{
                  backgroundColor: "#f8fafc",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  color: "#263238",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                {etapaAtual > 0 ? (
                  <span>
                    ({etapaAtual}/3){" "}
                    {descricoesEtapas[etapaAtual] ?? "Processando"}
                  </span>
                ) : (
                  <span>Iniciando processo...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
          {/* Linha 1: Seleção de Layout, Upload de PDF e Botão Validar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: "14px",
              alignItems: "flex-end",
              marginBottom: "16px",
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
                disabled={processando}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                  color: "#263238",
                  backgroundColor: processando ? "#f5f5f5" : "#ffffff",
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
                disabled={processando}
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
                  cursor: processando ? "not-allowed" : "pointer",
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

          {/* Linha 2: Configuração de Amostragem / Integral */}
          <div
            id="painel-opcoes-amostragem"
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #cfd8dc",
              borderRadius: "4px",
              padding: "10px 14px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              minHeight: "56px",
              boxSizing: "border-box",
            }}
          >
            {/* Controles de Seleção */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
                flexShrink: 0,
              }}
            >
              {/* Botão Liga / Desliga (Switch) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: "210px",
                }}
              >
                <button
                  type="button"
                  id="btn-switch-modo-validacao"
                  onClick={alternarModoValidacao}
                  disabled={processando}
                  style={{
                    position: "relative",
                    width: "44px",
                    height: "24px",
                    borderRadius: "12px",
                    backgroundColor: validarIntegralmente
                      ? "#00796b"
                      : "#78909c",
                    border: "none",
                    cursor: processando ? "not-allowed" : "pointer",
                    padding: "2px",
                    transition: "background-color 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      transform: validarIntegralmente
                        ? "translateX(20px)"
                        : "translateX(0px)",
                      transition: "transform 0.2s ease",
                    }}
                  ></span>
                </button>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: validarIntegralmente ? "#00796b" : "#455a64",
                    userSelect: "none",
                  }}
                >
                  {validarIntegralmente
                    ? "Validar Integralmente"
                    : "Validar por Amostragem"}
                </span>
              </div>

              {/* Campo Percentual */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <label
                  htmlFor="input-percentual-amostragem"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#455a64",
                    textTransform: "uppercase",
                  }}
                >
                  Amostragem:
                </label>
                <div style={{ position: "relative", width: "60px" }}>
                  <input
                    ref={inputAmostragemRef}
                    id="input-percentual-amostragem"
                    type="number"
                    min="0"
                    max="100"
                    value={percentualAmostragem}
                    onChange={lidarComMudancaPercentual}
                    disabled={validarIntegralmente || processando}
                    style={{
                      width: "100%",
                      padding: "4px 22px 4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #cfd8dc",
                      height: "30px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: validarIntegralmente ? "#78909c" : "#263238",
                      backgroundColor:
                        validarIntegralmente || processando
                          ? "#eceff1"
                          : "#ffffff",
                      cursor:
                        validarIntegralmente || processando
                          ? "not-allowed"
                          : "text",
                      boxSizing: "border-box",
                      textAlign: "right",
                    }}
                  ></input>
                  <span
                    style={{
                      position: "absolute",
                      right: "7px",
                      top: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: validarIntegralmente ? "#90a4ae" : "#455a64",
                      pointerEvents: "none",
                    }}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Mensagens Informativas */}
            <div
              style={{
                flex: "1 1 360px",
                minWidth: "280px",
                display: "flex",
                alignItems: "stretch",
              }}
            >
              {validarIntegralmente ? (
                <div
                  id="aviso-validacao-integral"
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    boxSizing: "border-box",
                    backgroundColor: "#e0f2f1",
                    border: "1px solid #b2dfdb",
                    borderRadius: "4px",
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>🟢</span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#004d40",
                      lineHeight: 1.25,
                    }}
                  >
                    <strong>Validação Integral (100%):</strong> Todas as páginas
                    serão auditadas. Porém, a validação pode demorar.
                  </span>
                </div>
              ) : (
                <div
                  id="aviso-validacao-amostragem"
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    boxSizing: "border-box",
                    backgroundColor: "#fff8e1",
                    border: "1px solid #ffe082",
                    borderRadius: "4px",
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>🟡</span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#795548",
                      lineHeight: 1.25,
                    }}
                  >
                    <strong>Amostragem ({percentualAmostragem}%):</strong>{" "}
                    Auditoria por amostragem aleatória. Mais rápido, porém
                    inconsistências fora da amostra podem não ser detectadas.
                  </span>
                </div>
              )}
            </div>
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

export default ValidacaoPage;
