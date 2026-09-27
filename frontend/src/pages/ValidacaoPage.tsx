<<<<<<< HEAD
import axios from "axios";
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
import { processamentoService } from "../services/processamentoService";
import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState, useRef } from "react";
import type {
  LayoutCliente,
  TipoProvedorBanco,
  ConfiguracaoBanco,
} from "../types/layout";
import type {
  InconsistenciaItem,
  ResultadoValidacaoLote,
} from "../types/validacao";

<<<<<<< HEAD
function extrairMensagemErroApi(erro: unknown): string | null {
  if (!axios.isAxiosError(erro)) return null;

  if (!erro.response) {
    return "Não foi possível comunicar com o servidor. Verifique se o backend está ativo.";
  }

  const dados = erro.response.data as
    | { erro?: string; mensagem?: string; detalhe?: string }
    | string
    | undefined;

  if (typeof dados === "string") return dados || null;
  return dados?.erro ?? dados?.detalhe ?? dados?.mensagem ?? null;
}

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
interface ValidacaoPageProps {
  layoutsDisponiveis: LayoutCliente[];
  onConcluirValidacao: (resultado: ResultadoValidacaoLote) => void;
}

export function ValidacaoPage({
  layoutsDisponiveis,
  onConcluirValidacao,
}: ValidacaoPageProps) {
  const [acordeonConexaoAberto, setAcordeonConexaoAberto] =
    useState<boolean>(false);
  const [acordeonImportarAberto, setAcordeonImportarAberto] =
    useState<boolean>(true);

  const [dbProvedor, setDbProvedor] = useState<TipoProvedorBanco>("SQL Server");
  const [dbServidor, setDbServidor] = useState<string>("");
  const [dbPorta, setDbPorta] = useState<string>("1433");
  const [dbNomeBanco, setDbNomeBanco] = useState<string>("");
  const [dbUsuario, setDbUsuario] = useState<string>("");
  const [dbSenha, setDbSenha] = useState<string>("");
<<<<<<< HEAD
  const [exibirSenha, setExibirSenha] = useState<boolean>(false);
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState<boolean>(false);

  const [etapaAtual, setEtapaAtual] = useState<number>(0);

  const descricoesEtapas: Record<number, string> = {
<<<<<<< HEAD
    0: "Validando conexão com o banco de dados...",
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    1: "Extraindo dados do arquivo...",
    2: "Buscando informações no banco de dados...",
    3: "Aplicando regras para validação...",
  };

  const [validarIntegralmente, setValidarIntegralmente] =
    useState<boolean>(true);
  const [percentualAmostragem, setPercentualAmostragem] = useState<number>(100);

  const inputAmostragemRef = useRef<HTMLInputElement | null>(null);

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
    if (!dbServidor.trim()) {
      setAcordeonConexaoAberto(true);
      exibirMensagem(
        "aviso",
        "Servidor Obrigatório",
        "Informe o endereço do Servidor de banco de dados na seção de Conexão.",
      );
      return;
    }

    if (!dbNomeBanco.trim()) {
      setAcordeonConexaoAberto(true);
      exibirMensagem(
        "aviso",
        "Base de Dados Obrigatória",
        "Informe o nome da Base de dados na seção de Conexão.",
      );
      return;
    }

    if (!dbUsuario.trim()) {
      setAcordeonConexaoAberto(true);
      exibirMensagem(
        "aviso",
        "Usuário Obrigatório",
        "Informe o Usuário de acesso ao banco de dados na seção de Conexão.",
      );
      return;
    }

    if (!layoutSelecionadoId) {
      setAcordeonImportarAberto(true);
      exibirMensagem(
        "aviso",
        "Layout Obrigatório",
        "Selecione o modelo de layout para validar os documentos.",
      );
      return;
    }

    if (!arquivo) {
      setAcordeonImportarAberto(true);
      exibirMensagem(
        "aviso",
        "Documento Pendente",
        "Faça o upload de um arquivo PDF para validação primeiro.",
      );
      return;
    }

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

<<<<<<< HEAD
    const configuracaoConexao: ConfiguracaoBanco = {
      provedor: dbProvedor,
      servidor: dbServidor.trim(),
      porta: Number(dbPorta) || 1433,
      baseDados: dbNomeBanco.trim(),
      usuario: dbUsuario.trim(),
      senha: dbSenha,
    };

    let etapaEmExecucao = 0;

    try {
      setEtapaAtual(0);
      const respostaConexao =
        await processamentoService.testarConexao(configuracaoConexao);
      const inicioProcessamento = respostaConexao?.inicioProcessamento;

      etapaEmExecucao = 1;
=======
    try {
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
      setEtapaAtual(1);
      const respostaExtracao = await processamentoService.extrair(
        arquivo,
        layoutEncontrado.id,
        percentualAmostragem ?? 100,
      );

<<<<<<< HEAD
      etapaEmExecucao = 2;
      setEtapaAtual(2);
=======
      setEtapaAtual(2);
      const configuracaoConexao: ConfiguracaoBanco = {
        provedor: dbProvedor,
        servidor: dbServidor.trim(),
        porta: Number(dbPorta) || 1433,
        baseDados: dbNomeBanco.trim(),
        usuario: dbUsuario.trim(),
        senha: dbSenha,
      };

>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
      await processamentoService.buscarBanco(
        layoutEncontrado.id,
        configuracaoConexao,
        arquivo.name,
        Boolean(respostaExtracao?.extracao?.usouOcr),
      );

<<<<<<< HEAD
      etapaEmExecucao = 3;
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
      setEtapaAtual(3);
      const utilizouOcr = Boolean(respostaExtracao?.extracao?.usouOcr);
      const dadosApi = await processamentoService.validarRegras(
        layoutEncontrado.id,
        arquivo.name,
        utilizouOcr,
<<<<<<< HEAD
        inicioProcessamento,
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
      );

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

      const resultadoConsolidado: ResultadoValidacaoLote = {
        nomeArquivo:
          dadosApi.NomeArquivo ?? dadosApi.nomeArquivo ?? arquivo.name,
        layoutUtilizado:
          dadosApi.LayoutUtilizado ??
          dadosApi.layoutUtilizado ??
          layoutEncontrado.nomeModelo,
        baseDados: dbNomeBanco.trim(),
        totalDocumentosAnalisados: totalDocs,
        documentosValidos: documentosValidos,
        documentosComInconsistencia: documentosInconsistentes,
        inconsistencias: divergenciasNormalizadas,
        validacoes: dadosApi.Validacoes ?? dadosApi.validacoes ?? [],
<<<<<<< HEAD
        percentualAmostragem:
          dadosApi.PercentualAmostragem ??
          dadosApi.percentualAmostragem ??
          percentualAmostragem ??
          100,
        usouOcr: dadosApi.UsouOcr ?? dadosApi.usouOcr ?? utilizouOcr,
        dataHoraInicio: dadosApi.DataHoraInicio ?? dadosApi.dataHoraInicio,
        dataHoraFim: dadosApi.DataHoraFim ?? dadosApi.dataHoraFim,
        falhas: dadosApi.Falhas ?? dadosApi.falhas ?? [],
=======
        amostragem:
          dadosApi.Amostragem ??
          dadosApi.amostragem ??
          percentualAmostragem ??
          100,
        usouOcr: dadosApi.UsouOcr ?? dadosApi.usouOcr ?? utilizouOcr,
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
      };

      onConcluirValidacao(resultadoConsolidado);
    } catch (erro: unknown) {
      console.error("Erro ao validar o lote de documentos:", erro);
<<<<<<< HEAD

      const detalheErro = extrairMensagemErroApi(erro);
      const falhaNaConexao = etapaEmExecucao === 0;

      if (falhaNaConexao) setAcordeonConexaoAberto(true);

      exibirMensagem(
        "erro",
        falhaNaConexao ? "Falha na Conexão com o Banco" : "Falha na Validação",
        detalheErro
          ? `${descricoesEtapas[etapaEmExecucao].replace("...", "")}: ${detalheErro}`
          : "Ocorreu um erro ao processar as etapas no backend. Verifique se o servidor está ativo e as credenciais estão corretas.",
=======
      exibirMensagem(
        "erro",
        "Falha na Validação",
        "Ocorreu um erro ao processar as etapas no backend. Verifique se o servidor está ativo e as credenciais estão corretas.",
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
      );
    } finally {
      setProcessando(false);
      setEtapaAtual(0);
    }
  };

  return (
    <div id="container-validacao-pdf" style={{ position: "relative" }}>
      {/* BLOQUEIO DE TELA / STATUS DA ETAPA EM EXECUÇÃO */}
      {processando && (
        <div
          id="overlay-bloqueio-processamento"
          className="smar-overlay-loading"
        >
          <div id="card-status-processamento" className="smar-status-card">
            <div className="smar-spinner"></div>
            <div style={{ width: "100%", textAlign: "center" }}>
              <strong
                style={{
                  display: "block",
                  color: "var(--smar-teal-dark)",
                  fontSize: "1rem",
                  marginBottom: "10px",
                  fontWeight: 700,
                }}
              >
                Validando Documentos
              </strong>

              <div
                id="etapa-corrente-processamento"
                style={{
                  backgroundColor: "var(--smar-bg-subtle)",
                  padding: "10px 14px",
                  color: "var(--smar-text-primary)",
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
<<<<<<< HEAD
                  <span>{descricoesEtapas[0]}</span>
=======
                  <span>Iniciando processo...</span>
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. ACORDEÃO: CONEXÃO COM O BANCO DE DADOS */}
      <section
        id="accordion-conexao-banco-validacao"
        className="smar-accordion"
      >
        <div
          onClick={() =>
            !processando && setAcordeonConexaoAberto((aberto) => !aberto)
          }
          className={`smar-accordion-header ${acordeonConexaoAberto ? "aberto" : "fechado"}`}
          style={{ cursor: processando ? "not-allowed" : "pointer" }}
        >
          <div className="smar-accordion-title">
            <span className="smar-accordion-icon">
              {acordeonConexaoAberto ? "▼" : "▶"}
            </span>
            <strong>1. Conexão com o banco de dados</strong>
          </div>
          <span
            style={{ fontSize: "0.75rem", color: "var(--smar-text-secondary)" }}
          >
            {dbServidor && dbNomeBanco
              ? `${dbProvedor}: ${dbServidor} / ${dbNomeBanco}`
              : "Informe as credenciais"}
          </span>
        </div>

        <div
          className={`smar-accordion-content-wrapper ${
            acordeonConexaoAberto
              ? "smar-accordion-content-open"
              : "smar-accordion-content-closed"
          }`}
        >
          {/* ALERTA DE SEGURANÇA */}
          <div
            id="alerta-seguranca-banco-validacao"
            className="smar-alert smar-alert-warning"
            style={{ marginBottom: "16px" }}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>⚠️</span>
            <div style={{ lineHeight: 1.4 }}>
              <strong>Observações:</strong>
              <p style={{ margin: "4px 0 0 0" }}>
                Por motivos de segurança, as credenciais informadas aqui não
                serão salvas. Utilize preferencialmente credenciais de um
                usuário com <strong>permissão de somente leitura</strong> no
                banco de dados.
              </p>
            </div>
          </div>

          {/* PROVEDOR DO BANCO */}
          <div style={{ marginBottom: "14px" }}>
            <label
              htmlFor="select-provedor-banco-validacao"
              className="smar-label"
            >
              Banco de dados
            </label>
            <select
              id="select-provedor-banco-validacao"
              value={dbProvedor}
              onChange={(e) =>
                setDbProvedor(e.target.value as TipoProvedorBanco)
              }
              disabled={processando}
              className="smar-select"
              style={{ maxWidth: "280px", fontWeight: 600 }}
            >
              <option value="SQL Server">SQL Server</option>
            </select>
          </div>

          {/* SERVIDOR E PORTA */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "14px",
              marginBottom: "14px",
            }}
          >
            <div>
              <label
                htmlFor="input-servidor-banco-validacao"
                className="smar-label"
              >
                Servidor
              </label>
              <input
                id="input-servidor-banco-validacao"
                type="text"
                value={dbServidor}
                onChange={(e) => setDbServidor(e.target.value)}
                disabled={processando}
                placeholder="Ex: PMTesteSQL2 ou 172.168.0.00"
                className="smar-input"
              ></input>
            </div>
            <div>
              <label
                htmlFor="input-porta-banco-validacao"
                className="smar-label"
              >
                Porta
              </label>
              <input
                id="input-porta-banco-validacao"
                type="number"
                value={dbPorta}
                onChange={(e) => setDbPorta(e.target.value)}
                disabled={processando}
                placeholder="1433"
                className="smar-input"
              ></input>
            </div>
          </div>

          {/* BASE DE DADOS */}
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="input-base-dados-validacao" className="smar-label">
              Base de dados
            </label>
            <input
              id="input-base-dados-validacao"
              type="text"
              value={dbNomeBanco}
              onChange={(e) => setDbNomeBanco(e.target.value)}
              disabled={processando}
              placeholder="Ex: SMARtb_Cliente1"
              className="smar-input"
            ></input>
          </div>

          {/* USUÁRIO E SENHA */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label
                htmlFor="input-usuario-banco-validacao"
                className="smar-label"
              >
                Usuário
              </label>
              <input
                id="input-usuario-banco-validacao"
                type="text"
                value={dbUsuario}
                onChange={(e) => setDbUsuario(e.target.value)}
                disabled={processando}
                placeholder="Ex: smartbValidacao"
                className="smar-input"
              ></input>
            </div>
            <div>
              <label
                htmlFor="input-senha-banco-validacao"
                className="smar-label"
              >
                Senha
              </label>
<<<<<<< HEAD
              <div style={{ position: "relative" }}>
                <input
                  id="input-senha-banco-validacao"
                  type={exibirSenha ? "text" : "password"}
                  value={dbSenha}
                  onChange={(e) => setDbSenha(e.target.value)}
                  disabled={processando}
                  placeholder="••••••••"
                  className="smar-input"
                  style={{ paddingRight: "40px" }}
                ></input>
                <button
                  type="button"
                  onClick={() => setExibirSenha((atual) => !atual)}
                  disabled={processando}
                  aria-label={exibirSenha ? "Ocultar senha" : "Exibir senha"}
                  title={exibirSenha ? "Ocultar senha" : "Exibir senha"}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "8px",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    padding: "4px",
                    cursor: processando ? "not-allowed" : "pointer",
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {exibirSenha ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
=======
              <input
                id="input-senha-banco-validacao"
                type="password"
                value={dbSenha}
                onChange={(e) => setDbSenha(e.target.value)}
                disabled={processando}
                placeholder="••••••••"
                className="smar-input"
              ></input>
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
            </div>
          </div>
        </div>
      </section>

      {/* 2. ACORDEÃO: IMPORTAR DOCUMENTOS */}
      <section
        id="accordion-importar-documentos-validacao"
        className="smar-accordion"
      >
        <div
          onClick={() =>
            !processando && setAcordeonImportarAberto((aberto) => !aberto)
          }
          className={`smar-accordion-header ${acordeonImportarAberto ? "aberto" : "fechado"}`}
          style={{ cursor: processando ? "not-allowed" : "pointer" }}
        >
          <div className="smar-accordion-title">
            <span className="smar-accordion-icon">
              {acordeonImportarAberto ? "▼" : "▶"}
            </span>
            <strong>2. Importar documentos</strong>
          </div>
          <span
            style={{ fontSize: "0.75rem", color: "var(--smar-text-secondary)" }}
          >
            {arquivo ? arquivo.name : "Nenhum arquivo selecionado"}
          </span>
        </div>

        <div
          className={`smar-accordion-content-wrapper ${
            acordeonImportarAberto
              ? "smar-accordion-content-open"
              : "smar-accordion-content-closed"
          }`}
        >
          {/* Seleção de Layout e Upload de PDF */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              alignItems: "flex-end",
              marginBottom: "16px",
            }}
          >
            <div>
              <label htmlFor="select-layout-aplicado" className="smar-label">
                Layout
              </label>
              <select
                id="select-layout-aplicado"
                value={layoutSelecionadoId}
                onChange={(e) => setLayoutSelecionadoId(e.target.value)}
                disabled={processando}
                className="smar-select"
              >
                <option value="">(Selecione um layout)</option>
                {layoutsDisponiveis.map((l) => (
                  <option key={l.nomeModelo} value={l.nomeModelo}>
                    {l.nomeModelo} ({l.cliente})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span id="label-arquivo-pdf" className="smar-label">
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
                  backgroundColor: arquivo
                    ? "var(--smar-success-bg)"
                    : "#ffffff",
                  border: arquivo
                    ? "1px solid #81c784"
                    : "1px solid var(--smar-border-color)",
                  borderRadius: "var(--smar-radius)",
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
                      color: arquivo
                        ? "var(--smar-success-text)"
                        : "var(--smar-text-muted)",
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
                    backgroundColor: "var(--smar-teal-primary)",
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
          </div>

          {/* Configuração de Amostragem / Integral */}
          <div
            id="painel-opcoes-amostragem"
            style={{
              backgroundColor: "var(--smar-bg-subtle)",
              border: "1px solid var(--smar-border-color)",
              borderRadius: "var(--smar-radius)",
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
                flexShrink: 0,
              }}
            >
              {/* Switch Liga/Desliga */}
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
                  className={`smar-switch ${validarIntegralmente ? "smar-switch-on" : "smar-switch-off"}`}
                >
                  <span className="smar-switch-thumb"></span>
                </button>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: validarIntegralmente
                      ? "var(--smar-teal-dark)"
                      : "var(--smar-text-label)",
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
                  className="smar-label"
                  style={{ marginBottom: 0 }}
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
                    className="smar-input"
                    style={{
                      padding: "4px 22px 4px 8px",
                      height: "30px",
                      fontWeight: 700,
                      textAlign: "right",
                      backgroundColor:
                        validarIntegralmente || processando
                          ? "#eceff1"
                          : "#ffffff",
                    }}
                  ></input>
                  <span
                    style={{
                      position: "absolute",
                      right: "7px",
                      top: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: validarIntegralmente
                        ? "var(--smar-border-dark)"
                        : "var(--smar-text-label)",
                      pointerEvents: "none",
                    }}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Mensagens Informativas de Amostragem */}
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
                  className="smar-alert smar-alert-info"
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>🟢</span>
                  <span>
                    <strong>Validação Integral (100%):</strong> Todas as páginas
                    serão auditadas. Porém, a validação pode demorar.
                  </span>
                </div>
              ) : (
                <div
                  id="aviso-validacao-amostragem"
                  className="smar-alert smar-alert-warning"
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>🟡</span>
                  <span>
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

      {/* RODAPÉ: BOTÃO DE DISPARO DA VALIDAÇÃO */}
      <div id="rodape-executar-validacao" className="smar-footer-actions">
        <button
          type="button"
          id="btn-executar-validacao"
          onClick={executarValidacao}
          disabled={processando}
          className="smar-btn smar-btn-save"
        >
          <span>{processando ? "Auditando..." : "Validar"}</span>
        </button>
      </div>

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
