import axios from "axios";
import {
  processamentoService,
  type SituacaoFilaProcessamento,
} from "../services/processamentoService";
import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState, useRef, useEffect } from "react";
import { CarregandoTela } from "../components/CarregandoTela";
import { Painel } from "../components/Painel";
import type {
  LayoutCliente,
  TipoProvedorBanco,
  ConfiguracaoBanco,
} from "../types/layout";
import type { ResultadoValidacaoLote } from "../types/validacao";

function extrairMensagemErroApi(erro: unknown): string | null {
  if (!axios.isAxiosError(erro)) return null;

  if (!erro.response) {
    return "Não foi possível comunicar com o servidor. Verifique se o backend está ativo.";
  }

  const dados = erro.response.data as
    { erro?: string; mensagem?: string; detalhe?: string } | string | undefined;

  if (typeof dados === "string") return dados || null;
  return dados?.erro ?? dados?.detalhe ?? dados?.mensagem ?? null;
}

// O servidor libera o lugar de quem fica 2 minutos sem consultar a fila
const INTERVALO_CONSULTA_FILA_MS = 3000;

const esperar = (ms: number) =>
  new Promise<void>((resolver) => window.setTimeout(resolver, ms));

interface DadosValidacao {
  arquivo: File;
  layoutId: string;
  conexao: ConfiguracaoBanco;
  percentualAmostragem: number;
}

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
  const [exibirSenha, setExibirSenha] = useState<boolean>(false);

  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState<boolean>(false);

  const [etapaAtual, setEtapaAtual] = useState<number>(0);

  // Preenchida enquanto o usuário aguarda outra pessoa terminar de validar
  const [posicaoFila, setPosicaoFila] = useState<number | null>(null);

  // Cada espera na fila recebe um número; cancelar ou sair da tela invalida a espera em andamento
  const esperaFilaAtualRef = useRef(0);
  const aguardandoFilaRef = useRef(false);

  useEffect(() => {
    const esperaFilaAtual = esperaFilaAtualRef;
    const aguardandoFila = aguardandoFilaRef;
    return () => {
      if (!aguardandoFila.current) return;
      esperaFilaAtual.current++;
      processamentoService.sairDaFila().catch(() => {});
    };
  }, []);

  const descricoesEtapas: Record<number, string> = {
    0: "Validando conexão com o banco de dados...",
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
    textoCancelar?: string;
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

  const obterDadosValidacao = (): DadosValidacao | null => {
    if (!dbServidor.trim()) {
      setAcordeonConexaoAberto(true);
      exibirMensagem(
        "aviso",
        "Servidor Obrigatório",
        "Informe o endereço do Servidor de banco de dados na seção de Conexão.",
      );
      return null;
    }

    if (!dbNomeBanco.trim()) {
      setAcordeonConexaoAberto(true);
      exibirMensagem(
        "aviso",
        "Base de Dados Obrigatória",
        "Informe o nome da Base de dados na seção de Conexão.",
      );
      return null;
    }

    if (!dbUsuario.trim()) {
      setAcordeonConexaoAberto(true);
      exibirMensagem(
        "aviso",
        "Usuário Obrigatório",
        "Informe o Usuário de acesso ao banco de dados na seção de Conexão.",
      );
      return null;
    }

    if (!layoutSelecionadoId) {
      setAcordeonImportarAberto(true);
      exibirMensagem(
        "aviso",
        "Layout Obrigatório",
        "Selecione o modelo de layout para validar os documentos.",
      );
      return null;
    }

    if (!arquivo) {
      setAcordeonImportarAberto(true);
      exibirMensagem(
        "aviso",
        "Documento Pendente",
        "Faça o upload de um arquivo PDF para validação primeiro.",
      );
      return null;
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
      return null;
    }

    return {
      arquivo,
      layoutId: layoutEncontrado.id,
      conexao: {
        provedor: dbProvedor,
        servidor: dbServidor.trim(),
        porta: Number(dbPorta) || 1433,
        baseDados: dbNomeBanco.trim(),
        usuario: dbUsuario.trim(),
        senha: dbSenha,
      },
      percentualAmostragem: percentualAmostragem ?? 100,
    };
  };

  const exibirErroFila = (erro: unknown) => {
    const validacaoPropriaEmAndamento =
      axios.isAxiosError(erro) && erro.response?.status === 409;

    exibirMensagem(
      validacaoPropriaEmAndamento ? "aviso" : "erro",
      validacaoPropriaEmAndamento
        ? "Validação em Andamento"
        : "Fila de Validação Indisponível",
      extrairMensagemErroApi(erro) ??
        "Não foi possível verificar a fila de validação. Tente novamente.",
    );
  };

  // Apenas uma validação é processada por vez no servidor; se outra pessoa estiver validando,
  // o usuário decide se entra na fila
  const executarValidacao = async () => {
    const dados = obterDadosValidacao();
    if (!dados) return;

    setProcessando(true);

    let situacao: SituacaoFilaProcessamento;
    try {
      situacao = await processamentoService.entrarNaFila(false);
    } catch (erro: unknown) {
      setProcessando(false);
      exibirErroFila(erro);
      return;
    }

    if (situacao.liberado) {
      await processarValidacao(dados);
      return;
    }

    setProcessando(false);

    const outrasAguardando = situacao.posicao - 1;
    const complementoFila =
      outrasAguardando > 0
        ? ` Além dela, ${
            outrasAguardando === 1
              ? "há 1 validação aguardando"
              : `há ${outrasAguardando} validações aguardando`
          } na fila.`
        : "";

    setModalInfo({
      aberto: true,
      tipo: "confirmacao",
      titulo: "Validação em Andamento",
      mensagem: `Outra pessoa já está validando um arquivo neste momento.${complementoFila}\n\nSe desejar prosseguir, sua validação entrará na fila e o arquivo será processado automaticamente assim que a outra pessoa terminar.\n\nDeseja entrar na fila?`,
      textoConfirmar: "Entrar na fila",
      textoCancelar: "Cancelar",
      aoConfirmar: () => aguardarVezNaFila(dados),
    });
  };

  const aguardarVezNaFila = async (dados: DadosValidacao) => {
    const idEspera = ++esperaFilaAtualRef.current;
    const esperaAtiva = () => esperaFilaAtualRef.current === idEspera;

    aguardandoFilaRef.current = true;
    setProcessando(true);

    try {
      for (;;) {
        const situacao = await processamentoService.entrarNaFila(true);

        if (!esperaAtiva()) {
          // A resposta chegou depois do cancelamento e pode ter recolocado o usuário na fila
          processamentoService.sairDaFila().catch(() => {});
          return;
        }

        if (situacao.liberado) break;

        setPosicaoFila(situacao.posicao);
        await esperar(INTERVALO_CONSULTA_FILA_MS);
        if (!esperaAtiva()) return;
      }
    } catch (erro: unknown) {
      if (!esperaAtiva()) return;
      aguardandoFilaRef.current = false;
      setPosicaoFila(null);
      setProcessando(false);
      exibirErroFila(erro);
      processamentoService.sairDaFila().catch(() => {});
      return;
    }

    aguardandoFilaRef.current = false;
    setPosicaoFila(null);
    await processarValidacao(dados);
  };

  const cancelarEsperaNaFila = () => {
    esperaFilaAtualRef.current++;
    aguardandoFilaRef.current = false;
    setPosicaoFila(null);
    setProcessando(false);
    processamentoService.sairDaFila().catch(() => {});
  };

  const processarValidacao = async ({
    arquivo,
    layoutId,
    conexao,
    percentualAmostragem,
  }: DadosValidacao) => {
    setProcessando(true);

    let etapaEmExecucao = 0;

    try {
      setEtapaAtual(0);
      const respostaConexao = await processamentoService.testarConexao(conexao);
      const inicioProcessamento = respostaConexao?.inicioProcessamento;

      etapaEmExecucao = 1;
      setEtapaAtual(1);
      const respostaExtracao = await processamentoService.extrair(
        arquivo,
        layoutId,
        percentualAmostragem,
      );

      etapaEmExecucao = 2;
      setEtapaAtual(2);
      await processamentoService.buscarBanco(
        layoutId,
        conexao,
        arquivo.name,
        Boolean(respostaExtracao?.extracao?.usouOcr),
      );

      etapaEmExecucao = 3;
      setEtapaAtual(3);
      const utilizouOcr = Boolean(respostaExtracao?.extracao?.usouOcr);
      const dadosApi = await processamentoService.validarRegras(
        layoutId,
        arquivo.name,
        utilizouOcr,
        inicioProcessamento,
      );

      onConcluirValidacao({ ...dadosApi, baseDados: conexao.baseDados });
    } catch (erro: unknown) {
      console.error("Erro ao validar o lote de documentos:", erro);

      const detalheErro = extrairMensagemErroApi(erro);
      const falhaNaConexao = etapaEmExecucao === 0;

      if (falhaNaConexao) setAcordeonConexaoAberto(true);

      exibirMensagem(
        "erro",
        falhaNaConexao ? "Falha na Conexão com o Banco" : "Falha na Validação",
        detalheErro
          ? `${descricoesEtapas[etapaEmExecucao].replace("...", "")}: ${detalheErro}`
          : "Ocorreu um erro ao processar as etapas no backend. Verifique se o servidor está ativo e as credenciais estão corretas.",
      );
    } finally {
      setProcessando(false);
      setEtapaAtual(0);
      processamentoService.sairDaFila().catch(() => {});
    }
  };

  const textoCarregamento =
    posicaoFila !== null
      ? `Outra pessoa está validando um arquivo. ${
          posicaoFila <= 1
            ? "Sua validação é a próxima da fila"
            : `Sua validação é a ${posicaoFila}ª da fila`
        } e começará automaticamente assim que chegar a sua vez.`
      : etapaAtual > 0
        ? `(${etapaAtual}/3) ${descricoesEtapas[etapaAtual] ?? "Processando"}`
        : descricoesEtapas[0];

  return (
    <div id="container-validacao-pdf" className="row">
      {processando && (
        <CarregandoTela
          id="overlay-bloqueio-processamento"
          texto={textoCarregamento}
        >
          {posicaoFila !== null && (
            <button
              type="button"
              id="btn-sair-fila-validacao"
              className="btn btn-cancel"
              onClick={cancelarEsperaNaFila}
            >
              <i className="fa fa-ban"></i> Sair da fila
            </button>
          )}
        </CarregandoTela>
      )}

      <div className="col">
        <form
          className="box-form-cadastro"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="row">
            <div className="col-lg-12">
              <Painel
                id="accordion-conexao-banco-validacao"
                titulo="1. Conexão com o banco de dados"
                resumo={
                  dbServidor && dbNomeBanco
                    ? `${dbProvedor}: ${dbServidor} / ${dbNomeBanco}`
                    : "Informe as credenciais"
                }
                aberto={acordeonConexaoAberto}
                aoAlternar={() =>
                  !processando && setAcordeonConexaoAberto((aberto) => !aberto)
                }
              >
                <div
                  id="alerta-seguranca-banco-validacao"
                  className="alert alert-inline alert-warning"
                >
                  <i className="fas fa-exclamation-triangle"></i>
                  <div>
                    <strong>Observações:</strong> Por motivos de segurança, as
                    credenciais informadas aqui não serão salvas. Utilize
                    preferencialmente credenciais de um usuário com{" "}
                    <strong>permissão de somente leitura</strong> no banco de
                    dados.
                  </div>
                </div>

                <div className="row">
                  <div className="col-lg-3">
                    <label htmlFor="select-provedor-banco-validacao">
                      Banco de dados
                      <span className="required-star"></span>
                    </label>
                    <select
                      id="select-provedor-banco-validacao"
                      value={dbProvedor}
                      onChange={(e) =>
                        setDbProvedor(e.target.value as TipoProvedorBanco)
                      }
                      disabled={processando}
                      className="form-control"
                    >
                      <option value="SQL Server">SQL Server</option>
                    </select>
                  </div>

                  <div className="col-lg-7">
                    <label htmlFor="input-servidor-banco-validacao">
                      Servidor
                      <span className="required-star"></span>
                    </label>
                    <input
                      id="input-servidor-banco-validacao"
                      type="text"
                      value={dbServidor}
                      onChange={(e) => setDbServidor(e.target.value)}
                      disabled={processando}
                      placeholder="Ex: PMTesteSQL2 ou 172.168.0.00"
                      className="form-control"
                    ></input>
                  </div>

                  <div className="col-lg-2">
                    <label htmlFor="input-porta-banco-validacao">Porta</label>
                    <input
                      id="input-porta-banco-validacao"
                      type="number"
                      value={dbPorta}
                      onChange={(e) => setDbPorta(e.target.value)}
                      disabled={processando}
                      placeholder="1433"
                      className="form-control"
                    ></input>
                  </div>
                </div>

                <div className="row">
                  <div className="col-lg-4">
                    <label htmlFor="input-base-dados-validacao">
                      Base de dados
                      <span className="required-star"></span>
                    </label>
                    <input
                      id="input-base-dados-validacao"
                      type="text"
                      value={dbNomeBanco}
                      onChange={(e) => setDbNomeBanco(e.target.value)}
                      disabled={processando}
                      placeholder="Ex: SMARtb_Cliente1"
                      className="form-control"
                    ></input>
                  </div>

                  <div className="col-lg-4">
                    <label htmlFor="input-usuario-banco-validacao">
                      Usuário
                      <span className="required-star"></span>
                    </label>
                    <input
                      id="input-usuario-banco-validacao"
                      type="text"
                      value={dbUsuario}
                      onChange={(e) => setDbUsuario(e.target.value)}
                      disabled={processando}
                      placeholder="Ex: smartbValidacao"
                      className="form-control"
                    ></input>
                  </div>

                  <div className="col-lg-4">
                    <label htmlFor="input-senha-banco-validacao">Senha</label>
                    <div className="input-group">
                      <input
                        id="input-senha-banco-validacao"
                        type={exibirSenha ? "text" : "password"}
                        value={dbSenha}
                        onChange={(e) => setDbSenha(e.target.value)}
                        disabled={processando}
                        placeholder="••••••••"
                        className="form-control"
                      ></input>
                      <div className="input-group-append">
                        <button
                          type="button"
                          className="btn btn-primary btn-custom"
                          onClick={() => setExibirSenha((atual) => !atual)}
                          disabled={processando}
                          aria-label={
                            exibirSenha ? "Ocultar senha" : "Exibir senha"
                          }
                          title={exibirSenha ? "Ocultar senha" : "Exibir senha"}
                        >
                          <i
                            className={
                              exibirSenha ? "fas fa-eye-slash" : "fas fa-eye"
                            }
                          ></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Painel>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-12">
              <Painel
                id="accordion-importar-documentos-validacao"
                titulo="2. Importar documentos"
                resumo={arquivo ? arquivo.name : "Nenhum arquivo selecionado"}
                aberto={acordeonImportarAberto}
                aoAlternar={() =>
                  !processando && setAcordeonImportarAberto((aberto) => !aberto)
                }
              >
                <div className="row">
                  <div className="col-lg-6">
                    <label htmlFor="select-layout-aplicado">
                      Layout
                      <span className="required-star"></span>
                    </label>
                    <select
                      id="select-layout-aplicado"
                      value={layoutSelecionadoId}
                      onChange={(e) => setLayoutSelecionadoId(e.target.value)}
                      disabled={processando}
                      className="form-control"
                    >
                      <option value="">Selecione</option>
                      {layoutsDisponiveis.map((l) => (
                        <option key={l.nomeModelo} value={l.nomeModelo}>
                          {l.nomeModelo} ({l.cliente})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-lg-6">
                    <label id="label-arquivo-pdf" htmlFor="input-arquivo-pdf">
                      Arquivo para validação
                      <span className="required-star"></span>
                    </label>

                    <input
                      id="input-arquivo-pdf"
                      type="file"
                      accept="application/pdf"
                      onChange={lidarComArquivo}
                      disabled={processando}
                      className="d-none"
                    ></input>

                    <label
                      htmlFor="input-arquivo-pdf"
                      id="btn-trigger-upload-pdf"
                      className={`input-group campo-arquivo ${processando ? "desabilitado" : ""}`}
                    >
                      <span
                        className={`form-control campo-arquivo-nome ${arquivo ? "selecionado" : ""}`}
                      >
                        <i
                          className={
                            arquivo ? "fas fa-file-pdf" : "fas fa-folder-open"
                          }
                        ></i>{" "}
                        {arquivo
                          ? arquivo.name
                          : "Selecionar documento em PDF..."}
                      </span>
                      <span className="input-group-append">
                        <span className="btn btn-primary">
                          <i className="fas fa-upload"></i> Importar
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div
                  id="painel-opcoes-amostragem"
                  className="row align-items-end"
                >
                  <div className="col-lg-3">
                    <label htmlFor="btn-switch-modo-validacao">
                      Modo de validação
                    </label>
                    <div
                      className="d-flex align-items-center"
                      style={{ height: "30px" }}
                    >
                      <div className="onoffswitch">
                        <input
                          type="checkbox"
                          id="btn-switch-modo-validacao"
                          className="onoffswitch-checkbox"
                          checked={validarIntegralmente}
                          onChange={alternarModoValidacao}
                          disabled={processando}
                        ></input>
                        <label
                          className="onoffswitch-label"
                          htmlFor="btn-switch-modo-validacao"
                        >
                          <span className="onoffswitch-inner"></span>
                          <span className="onoffswitch-switch"></span>
                        </label>
                      </div>
                      <span className="ml-3">
                        {validarIntegralmente
                          ? "Validar integralmente"
                          : "Validar por amostragem"}
                      </span>
                    </div>
                  </div>

                  <div className="col-lg-2">
                    <label htmlFor="input-percentual-amostragem">
                      Amostragem
                    </label>
                    <div className="input-group">
                      <input
                        ref={inputAmostragemRef}
                        id="input-percentual-amostragem"
                        type="number"
                        min="0"
                        max="100"
                        value={percentualAmostragem}
                        onChange={lidarComMudancaPercentual}
                        disabled={validarIntegralmente || processando}
                        className="form-control text-right"
                      ></input>
                      <div className="input-group-append">
                        <span className="input-group-text">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-7">
                    {validarIntegralmente ? (
                      <div
                        id="aviso-validacao-integral"
                        className="alert alert-inline alert-info mb-0"
                      >
                        <i className="fas fa-info-circle"></i>
                        <span>
                          <strong>Validação Integral (100%):</strong> Todas as
                          páginas serão auditadas. Porém, a validação pode
                          demorar.
                        </span>
                      </div>
                    ) : (
                      <div
                        id="aviso-validacao-amostragem"
                        className="alert alert-inline alert-warning mb-0"
                      >
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>
                          <strong>Amostragem ({percentualAmostragem}%):</strong>{" "}
                          Auditoria por amostragem aleatória. Mais rápido, porém
                          inconsistências fora da amostra podem não ser
                          detectadas.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Painel>
            </div>
          </div>

          <div id="rodape-executar-validacao" className="row">
            <div className="btn-forms col">
              <button
                type="button"
                id="btn-executar-validacao"
                onClick={executarValidacao}
                disabled={processando}
                className="btn btn-primary"
              >
                <i
                  className={
                    processando ? "fas fa-spinner fa-spin" : "fas fa-check"
                  }
                ></i>{" "}
                {!processando
                  ? "Validar"
                  : posicaoFila !== null
                    ? "Aguardando na fila..."
                    : "Auditando..."}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ModalInformativo
        aberto={modalInfo.aberto}
        tipo={modalInfo.tipo}
        titulo={modalInfo.titulo}
        mensagem={modalInfo.mensagem}
        textoConfirmar={modalInfo.textoConfirmar}
        textoCancelar={modalInfo.textoCancelar}
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
