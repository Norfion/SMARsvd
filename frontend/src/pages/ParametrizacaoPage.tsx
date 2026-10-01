import axios from "axios";
import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState, useRef, useEffect, useCallback } from "react";
import { SqlCodeEditor } from "../components/SqlCodeEditor";
import { Painel } from "../components/Painel";
import { processarArquivoPdfModelo } from "../utils/pdfModelReader";
import { gerarId } from "../utils/gerarId";
import {
  exportarArquivoLayout,
  lerArquivoLayout,
} from "../utils/arquivoLayout";
import {
  OPCOES_TIPO_DADO,
  TipoClassificacaoCampo,
  TipoDadoCampo,
  type RegiaoCampo,
  type LayoutCliente,
  type QueryValidacao,
  type RegraValidacao,
} from "../types/layout";
import { layoutService } from "../services/layoutService";

const COMANDOS_BLOQUEADOS =
  /\b(UPDATE|DELETE|INSERT|MERGE|EXEC|EXECUTE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|DENY|INTO|DBCC|BACKUP|RESTORE|SHUTDOWN|OPENROWSET|OPENQUERY|OPENDATASOURCE)\b/i;

// Strings, identificadores delimitados e comentários não devem disparar o bloqueio de comandos
const removerLiteraisEComentarios = (sql: string) =>
  sql.replace(
    /'(?:[^']|'')*'|\[[^\]]*\]|"[^"]*"|--[^\n]*|\/\*[\s\S]*?\*\//g,
    (trecho) => (trecho.startsWith("-") || trecho.startsWith("/") ? " " : "0"),
  );

// Retorna o motivo do bloqueio, ou null quando a instrução é um SELECT
const verificarSomenteSelect = (sql: string): string | null => {
  const sqlLimpo = removerLiteraisEComentarios(sql).trim();

  if (!/^(SELECT|WITH)\b/i.test(sqlLimpo)) {
    return "A instrução deve começar com SELECT (ou WITH, no caso de CTEs). São permitidas apenas consultas somente leitura.";
  }

  const comandoBloqueado = sqlLimpo.match(COMANDOS_BLOQUEADOS);
  if (comandoBloqueado) {
    return `O comando ${comandoBloqueado[1].toUpperCase()} não é permitido. São permitidas apenas consultas somente leitura (SELECT).`;
  }

  return null;
};

interface ParametrizacaoPageProps {
  layoutsSalvos: LayoutCliente[];
  onSalvarLayouts: (layouts: LayoutCliente[]) => void;
  onExcluirLayout?: (idOuNome: string, senhaExclusao: string) => Promise<void>;
  onImportarLayout: (layout: LayoutCliente) => Promise<LayoutCliente[]>;
  onHouveAlteracaoChange?: (houveAlteracao: boolean) => void;
}

const obterMensagemErroImportacao = (erro: unknown): string => {
  if (!axios.isAxiosError(erro)) {
    return erro instanceof Error
      ? erro.message
      : "Falha desconhecida na leitura do arquivo.";
  }

  if (erro.response?.status === 413) {
    return "O layout é grande demais para ser salvo. Reduza a quantidade de páginas do modelo de referência e exporte-o novamente.";
  }

  const dados = erro.response?.data as
    | {
        mensagem?: string;
        erros?: { linha: number; coluna: number; mensagem: string }[];
        errors?: Record<string, string[]>;
      }
    | undefined;

  if (dados?.mensagem) {
    const detalhes = (dados.erros ?? []).map(
      (e) => `• Linha ${e.linha}, coluna ${e.coluna}: ${e.mensagem}`,
    );
    return [dados.mensagem, ...detalhes].join("\n");
  }

  if (dados?.errors) {
    const detalhes = Object.values(dados.errors)
      .flat()
      .map((mensagem) => `• ${mensagem}`);
    return [
      "O arquivo contém valores fora dos limites permitidos:",
      ...detalhes,
    ].join("\n");
  }

  return "Não foi possível salvar o layout importado. Tente novamente.";
};

export function ParametrizacaoPage({
  layoutsSalvos,
  onSalvarLayouts,
  onExcluirLayout,
  onImportarLayout,
  onHouveAlteracaoChange,
}: ParametrizacaoPageProps) {
  const CLIENTES_DISPONIVEIS = [
    "PM Aluminio - SP",
    "PM Angatuba - SP",
    "PM Bertioga - SP",
    "PM Birigui - SP",
    "PM Cravinhos - SP",
    "PM Cubatão - SP",
    "PM Guarapari - ES",
    "PM Itápolis - SP",
    "PM Itatiba - SP",
    "PM Ituiutaba - SP",
    "PM Ituverava - SP",
    "PM Luiz Antonio - SP",
    "PM Mairinque - SP",
    "PM Marília - SP",
    "PM Matão - SP",
    "PM Nova Odessa - SP",
    "PM Olímpia - SP",
    "PM Ourinhos - SP",
    "PM Pederneiras - SP",
    "PM Pitangueiras - SP",
    "PM Ribeirão Pires - SP",
    "PM São João da Boa Vista - SP",
    "PM Serra - ES",
    "PM Sertãozinho - SP",
    "PM Valinhos - SP",
    "Outro",
  ];

  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [layoutId, setLayoutId] = useState<string | undefined>(undefined);
  const [etapaAberta, setEtapaAberta] = useState<
    "layout" | "campos" | "validacoes" | null
  >(null);

  const [modalNovoLayoutAberto, setModalNovoLayoutAberto] = useState(false);
  const [carregandoPdfModelo, setCarregandoPdfModelo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importandoLayout, setImportandoLayout] = useState(false);
  const arquivoLayoutInputRef = useRef<HTMLInputElement | null>(null);

  const [criandoNovoLayout, setCriandoNovoLayout] = useState(false);
  const [dadosOriginaisJson, setDadosOriginaisJson] = useState<string>("");

  const cancelarCriacaoNovoLayout = () => {
    setCriandoNovoLayout(false);
    setDadosOriginaisJson("");
    setLayoutSelecionadoId("");
    setLayoutId(undefined);
    setNomeModelo("");
    setCampos([]);
    setQueries([]);
    setPaginasModelo([]);
    setNomeArquivoModelo("");
    setEtapaAberta(null);
    cancelarEdicaoCampo();
    cancelarEdicaoQuery();
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

  const exibirConfirmacao = (
    titulo: string,
    mensagem: string,
    aoConfirmar: () => void,
    textoConfirmar = "Excluir",
  ) => {
    setModalInfo({
      aberto: true,
      tipo: "confirmacao",
      titulo,
      mensagem,
      textoConfirmar,
      aoConfirmar,
    });
  };

  const alternarEtapa = (etapa: "layout" | "campos" | "validacoes") => {
    if (!layoutSelecionadoId) return;
    setEtapaAberta((etapaAtual) => (etapaAtual === etapa ? null : etapa));
  };

  const [cliente, setCliente] = useState<string>("Outro");
  const [nomeModelo, setNomeModelo] = useState<string>("");
  const [larguraMm, setLarguraMm] = useState<number>(70);
  const [alturaMm, setAlturaMm] = useState<number>(30);
  const [paginasModelo, setPaginasModelo] = useState<string[]>([]);
  const [nomeArquivoModelo, setNomeArquivoModelo] = useState<string>("");

  const [opacidadeModelo, setOpacidadeModelo] = useState<number>(45);
  const [zoomNivel, setZoomNivel] = useState<number>(100);

  const LARGURA_CONTAINER_BASE_PX = 800;
  const escalaPxPorMmBase = LARGURA_CONTAINER_BASE_PX / (larguraMm || 1);
  const escalaPxPorMm = escalaPxPorMmBase * (zoomNivel / 100);

  const larguraVisualPx = Math.round(larguraMm * escalaPxPorMm);
  const alturaVisualPx = Math.round(alturaMm * escalaPxPorMm);

  const [campos, setCampos] = useState<RegiaoCampo[]>([]);

  const camposNormaisDisponiveis = campos.filter(
    (c) =>
      c.tipoClassificacao === TipoClassificacaoCampo.Nenhum ||
      c.tipoClassificacao === undefined,
  );

  const [campoEmEdicaoId, setCampoEmEdicaoId] = useState<string | null>(null);
  const [nomeCampo, setNomeCampo] = useState("");
  const [paginaCampo, setPaginaCampo] = useState<number>(1);
  const [paginaAtivaCanvas, setPaginaAtivaCanvas] = useState<number>(1);

  const [tipoClassificacao, setTipoClassificacao] =
    useState<TipoClassificacaoCampo>(TipoClassificacaoCampo.Nenhum);
  const [textoEsperadoDocumento, setTextoEsperadoDocumento] = useState("");
  const [textoEsperadoPagina, setTextoEsperadoPagina] = useState("");
  const [identificadorPagina, setIdentificadorPagina] = useState("");
  const [identificadorAnterior, setIdentificadorAnterior] = useState("");
  const [identificadorPosterior, setIdentificadorPosterior] = useState("");
  const [tipoDado, setTipoDado] = useState<TipoDadoCampo>(TipoDadoCampo.Texto);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const removerListenerRodaMouseRef = useRef<(() => void) | null>(null);

  // O onWheel do React é registrado como passivo, o que impede o preventDefault do zoom com Ctrl
  const viewportRef = useCallback((elemento: HTMLDivElement | null) => {
    removerListenerRodaMouseRef.current?.();
    removerListenerRodaMouseRef.current = null;
    if (!elemento) return;

    const lidarComRodaMouse = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      setZoomNivel((nivelAtual) =>
        Math.min(300, Math.max(50, nivelAtual + delta)),
      );
    };

    elemento.addEventListener("wheel", lidarComRodaMouse, { passive: false });
    removerListenerRodaMouseRef.current = () =>
      elemento.removeEventListener("wheel", lidarComRodaMouse);
  }, []);

  const [queries, setQueries] = useState<QueryValidacao[]>([]);
  const [queryEmEdicaoId, setQueryEmEdicaoId] = useState<string | null>(null);
  const [nomeQuery, setNomeQuery] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlAnalisado, setSqlAnalisado] = useState(false);
  const [analisandoSql, setAnalisandoSql] = useState(false);
  const sqlQueryAtualRef = useRef("");
  useEffect(() => {
    sqlQueryAtualRef.current = sqlQuery;
  }, [sqlQuery]);
  const [parametrosEncontrados, setParametrosEncontrados] = useState<string[]>(
    [],
  );
  const [camposRetornados, setCamposRetornados] = useState<string[]>([]);
  const [regrasAtuais, setRegrasAtuais] = useState<RegraValidacao[]>([]);
  const [regraCampoRetornado, setRegraCampoRetornado] = useState<string>("");
  const [regraOperador, setRegraOperador] = useState<string>("=");
  const [regraCampoCarne, setRegraCampoCarne] = useState<string>("");

  const emModoEdicao = campoEmEdicaoId !== null || queryEmEdicaoId !== null;
  const semLayoutSelecionado = !layoutSelecionadoId;

  const obterSnapshotAtual = () => {
    return JSON.stringify({
      cliente,
      nomeModelo: nomeModelo.trim(),
      larguraPaginaMm: larguraMm,
      alturaPaginaMm: alturaMm,
      campos,
      queriesValidacao: queries,
      paginasModeloBase64: paginasModelo,
    });
  };

  const houveAlteracao =
    criandoNovoLayout ||
    (Boolean(dadosOriginaisJson) &&
      obterSnapshotAtual() !== dadosOriginaisJson);

  useEffect(() => {
    if (onHouveAlteracaoChange) {
      onHouveAlteracaoChange(houveAlteracao);
    }
  }, [houveAlteracao, onHouveAlteracaoChange]);

  const iniciarCriacaoManual = () => {
    const nomePadrao = "Novo Layout";
    setModalNovoLayoutAberto(false);
    setLayoutId(undefined);
    setCriandoNovoLayout(true);
    setLayoutSelecionadoId(nomePadrao);
    setCliente("Outro");
    setNomeModelo(nomePadrao);
    setLarguraMm(70);
    setAlturaMm(30);
    setCampos([]);
    setQueries([]);
    setPaginasModelo([]);
    setNomeArquivoModelo("");
    setEtapaAberta("layout");
    cancelarEdicaoCampo();
    cancelarEdicaoQuery();
  };

  const dispararUploadModelo = () => {
    setModalNovoLayoutAberto(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const lidarComArquivoModelo = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    try {
      setCarregandoPdfModelo(true);
      const dados = await processarArquivoPdfModelo(arquivo);
      const nomeIdentificador = arquivo.name.replace(/\.[^/.]+$/, "");

      setLayoutId(undefined);
      setCriandoNovoLayout(true);
      setLayoutSelecionadoId(nomeIdentificador);
      setCliente("Outro");
      setNomeModelo(nomeIdentificador);
      setLarguraMm(dados.larguraMm);
      setAlturaMm(dados.alturaMm);
      setPaginasModelo(dados.paginasBase64);
      setNomeArquivoModelo(dados.nomeArquivo);

      setCampos([]);
      setQueries([]);
      setEtapaAberta("layout");
      setPaginaAtivaCanvas(1);
      setPaginaCampo(1);
      cancelarEdicaoCampo();
      cancelarEdicaoQuery();

      exibirMensagem(
        "sucesso",
        "Modelo Carregado",
        `PDF "${dados.nomeArquivo}" carregado com sucesso!\n\n• Páginas: ${dados.quantidadePaginas}\n• Dimensões: ${dados.larguraMm} x ${dados.alturaMm} mm`,
      );
    } catch (err: unknown) {
      const mensagemErro =
        err instanceof Error
          ? err.message
          : "Falha desconhecida no processamento";
      exibirMensagem(
        "erro",
        "Falha na Leitura",
        `Erro na leitura do modelo: ${mensagemErro}`,
      );
    } finally {
      setCarregandoPdfModelo(false);
    }
  };

  const executarExclusaoFisicaLayout = async (senhaExclusao: string) => {
    if (!layoutId) {
      exibirMensagem(
        "erro",
        "Erro na exclusão",
        "Não foi possível localizar o ID deste layout para excluí-lo no banco.",
      );
      return;
    }

    if (onExcluirLayout) {
      try {
        await onExcluirLayout(layoutId, senhaExclusao);
      } catch (erro: unknown) {
        const senhaRecusada =
          axios.isAxiosError(erro) && erro.response?.status === 403;
        const mensagemServidor = axios.isAxiosError(erro)
          ? (erro.response?.data as { mensagem?: string } | undefined)?.mensagem
          : undefined;

        exibirMensagem(
          senhaRecusada ? "aviso" : "erro",
          senhaRecusada ? "Senha Incorreta" : "Erro na exclusão",
          mensagemServidor ??
            "Não foi possível excluir o layout. Tente novamente.",
        );
        return;
      }
    }

    exibirMensagem(
      "sucesso",
      "Layout Removido",
      `O layout "${layoutSelecionadoId}" foi removido com sucesso!`,
    );
    setLayoutSelecionadoId("");
    setLayoutId(undefined);
    setCampos([]);
    setQueries([]);
    setPaginasModelo([]);
    setNomeArquivoModelo("");
    setEtapaAberta(null);
    cancelarEdicaoCampo();
    cancelarEdicaoQuery();
  };

  const removerLayoutAtual = () => {
    if (!layoutSelecionadoId) {
      exibirMensagem(
        "aviso",
        "Layout Inválido",
        "Por favor, selecione um layout antes de tentar remover.",
      );
      return;
    }
    setModalInfo({
      aberto: true,
      tipo: "confirmacao",
      titulo: "Excluir layout",
      mensagem: `Confirme a senha de segurança para excluir o layout "${layoutSelecionadoId}".\n\nEsse processo não poderá ser desfeito.`,
      textoConfirmar: "Excluir",
      exigeSenha: true,
      valorSenha: "",
      aoConfirmar: (senhaRecebida?: string) => {
        if (!senhaRecebida) {
          exibirMensagem(
            "aviso",
            "Senha Incorreta",
            "A senha digitada está incorreta. A exclusão foi cancelada.",
          );
          return;
        }
        void executarExclusaoFisicaLayout(senhaRecebida);
      },
    });
  };

  const carregarLayout = (nomeLayout: string) => {
    setCriandoNovoLayout(false);
    if (!nomeLayout) {
      setLayoutId(undefined);
      setLayoutSelecionadoId("");
      setDadosOriginaisJson("");
      setEtapaAberta(null);
      return;
    }

    const layout = layoutsSalvos.find((l) => l.nomeModelo === nomeLayout);
    if (!layout) return;

    aplicarLayout(layout);
  };

  const aplicarLayout = (layout: LayoutCliente) => {
    setCriandoNovoLayout(false);
    setLayoutId(layout.id);
    setLayoutSelecionadoId(layout.nomeModelo);
    setCliente(layout.cliente);
    setNomeModelo(layout.nomeModelo);
    setLarguraMm(layout.larguraPaginaMm);
    setAlturaMm(layout.alturaPaginaMm);

    const camposCarregados: RegiaoCampo[] = (layout.campos || []).map((c) => {
      let classif = c.tipoClassificacao;
      if (classif === undefined) {
        const cAny = c as unknown as Record<string, unknown>;
        if (cAny.ehIdentificadorInicio) {
          classif = TipoClassificacaoCampo.IdentificadorDocumento;
        } else if (cAny.ehIdentificadorPagina) {
          classif = TipoClassificacaoCampo.IdentificadorPagina;
        } else {
          classif = TipoClassificacaoCampo.Nenhum;
        }
      }

      const cAny = c as unknown as Record<string, unknown>;
      return {
        ...c,
        tipoClassificacao: classif,
        textoEsperadoDocumento:
          c.textoEsperadoDocumento ||
          (cAny.textoEsperadoInicio as string | undefined) ||
          "",
        textoEsperadoPagina: c.textoEsperadoPagina || "",
        identificadorPagina: c.identificadorPagina || "",
      };
    });

    setCampos(camposCarregados);
    setQueries(layout.queriesValidacao || []);
    setPaginasModelo(layout.paginasModeloBase64 || []);
    setNomeArquivoModelo(layout.nomeArquivoModelo || "");

    setDadosOriginaisJson(
      JSON.stringify({
        cliente: layout.cliente,
        nomeModelo: layout.nomeModelo.trim(),
        larguraPaginaMm: layout.larguraPaginaMm,
        alturaPaginaMm: layout.alturaPaginaMm,
        campos: camposCarregados,
        queriesValidacao: layout.queriesValidacao || [],
        paginasModeloBase64: layout.paginasModeloBase64 || [],
      }),
    );

    setEtapaAberta("layout");
    setPaginaAtivaCanvas(1);
    setPaginaCampo(1);
    cancelarEdicaoCampo();
    cancelarEdicaoQuery();
  };

  const exportarLayoutAtual = () => {
    const layout = layoutsSalvos.find((l) => l.nomeModelo === layoutSelecionadoId);
    if (!layout) {
      exibirMensagem(
        "aviso",
        "Layout Inválido",
        "Selecione um layout salvo antes de exportar.",
      );
      return;
    }

    exportarArquivoLayout(layout);
  };

  const dispararImportacaoLayout = () => {
    setModalNovoLayoutAberto(false);
    if (arquivoLayoutInputRef.current) {
      arquivoLayoutInputRef.current.value = "";
      arquivoLayoutInputRef.current.click();
    }
  };

  const executarImportacaoLayout = async (
    layoutImportado: LayoutCliente,
    idLayoutExistente?: string,
  ) => {
    try {
      setImportandoLayout(true);
      const listaAtualizada = await onImportarLayout({
        ...layoutImportado,
        id: idLayoutExistente,
      });

      const nomeBusca = layoutImportado.nomeModelo.toLowerCase();
      const layoutSalvo = listaAtualizada.find(
        (l) => l.nomeModelo.trim().toLowerCase() === nomeBusca,
      );
      if (layoutSalvo) aplicarLayout(layoutSalvo);

      exibirMensagem(
        "sucesso",
        idLayoutExistente ? "Layout Atualizado" : "Layout Importado",
        idLayoutExistente
          ? `O layout "${layoutImportado.nomeModelo}" foi atualizado com as configurações do arquivo.`
          : `O layout "${layoutImportado.nomeModelo}" foi importado e criado com sucesso!`,
      );
    } catch (erro: unknown) {
      exibirMensagem(
        "erro",
        "Falha na Importação",
        obterMensagemErroImportacao(erro),
      );
    } finally {
      setImportandoLayout(false);
    }
  };

  const lidarComArquivoLayout = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    let layoutImportado: LayoutCliente;
    try {
      layoutImportado = await lerArquivoLayout(arquivo);
    } catch (erro: unknown) {
      exibirMensagem(
        "erro",
        "Arquivo Inválido",
        obterMensagemErroImportacao(erro),
      );
      return;
    }

    // O seletor de layouts identifica cada layout pelo nome, por isso a comparação ignora o cliente
    const nomeBusca = layoutImportado.nomeModelo.toLowerCase();
    const layoutExistente = layoutsSalvos.find(
      (l) => l.nomeModelo.trim().toLowerCase() === nomeBusca,
    );

    if (!layoutExistente) {
      void executarImportacaoLayout(layoutImportado);
      return;
    }

    exibirConfirmacao(
      "Layout já existe",
      `O layout "${layoutExistente.nomeModelo}" (${layoutExistente.cliente}) já existe neste computador.\n\nDeseja atualizar o layout existente, sobrescrevendo todas as configurações dele pelas do arquivo?\n\nEsse processo não poderá ser desfeito.`,
      () => void executarImportacaoLayout(layoutImportado, layoutExistente.id),
      "Sobrescrever",
    );
  };

  const salvarTudo = () => {
    const nomeNormalizado = nomeModelo.trim();
    if (!nomeNormalizado) {
      exibirMensagem(
        "aviso",
        "Nome inválido",
        "Informe o nome do layout antes de salvar.",
      );
      return;
    }

    const layoutFinal: LayoutCliente = {
      id: layoutId,
      cliente,
      nomeModelo: nomeNormalizado,
      versao: 1,
      larguraPaginaMm: larguraMm,
      alturaPaginaMm: alturaMm,
      campos,
      queriesValidacao: queries,
      paginasModeloBase64: paginasModelo,
      nomeArquivoModelo,
    };

    const layoutJaExiste = layoutsSalvos.some(
      (l) => l.nomeModelo === layoutSelecionadoId,
    );

    if (layoutJaExiste) {
      onSalvarLayouts(
        layoutsSalvos.map((l) =>
          l.nomeModelo === layoutSelecionadoId ? layoutFinal : l,
        ),
      );
    } else {
      const nomeDuplicado = layoutsSalvos.some(
        (l) => l.nomeModelo.toLowerCase() === nomeNormalizado.toLowerCase(),
      );
      if (nomeDuplicado) {
        onSalvarLayouts(
          layoutsSalvos.map((l) =>
            l.nomeModelo.toLowerCase() === nomeNormalizado.toLowerCase()
              ? layoutFinal
              : l,
          ),
        );
      } else {
        onSalvarLayouts([...layoutsSalvos, layoutFinal]);
      }
    }

    setLayoutSelecionadoId(layoutFinal.nomeModelo);
    setCriandoNovoLayout(false);
    setDadosOriginaisJson(obterSnapshotAtual());
    exibirMensagem(
      "sucesso",
      "Layout Salvo",
      "Todas as configurações do layout foram salvas com sucesso!",
    );
  };

  const [desenhando, setDesenhando] = useState(false);
  const [inicioPosMm, setInicioPosMm] = useState<{ xMm: number; yMm: number }>({
    xMm: 0,
    yMm: 0,
  });
  const [retanguloAtualMm, setRetanguloAtualMm] = useState<{
    xMm: number;
    yMm: number;
    larguraMm: number;
    alturaMm: number;
  } | null>(null);

  const iniciarSelecao = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPx = Math.max(0, e.clientX - rect.left);
    const yPx = Math.max(0, e.clientY - rect.top);
    const xMm = Number((xPx / escalaPxPorMm).toFixed(2));
    const yMm = Number((yPx / escalaPxPorMm).toFixed(2));
    setInicioPosMm({ xMm, yMm });
    setRetanguloAtualMm({ xMm, yMm, larguraMm: 0, alturaMm: 0 });
    setDesenhando(true);
  };

  const atualizandoSelecao = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!desenhando || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorXPx = Math.max(
      0,
      Math.min(larguraVisualPx, e.clientX - rect.left),
    );
    const cursorYPx = Math.max(
      0,
      Math.min(alturaVisualPx, e.clientY - rect.top),
    );
    const cursorXMm = cursorXPx / escalaPxPorMm;
    const cursorYMm = cursorYPx / escalaPxPorMm;
    const xMm = Number(Math.min(inicioPosMm.xMm, cursorXMm).toFixed(2));
    const yMm = Number(Math.min(inicioPosMm.yMm, cursorYMm).toFixed(2));
    const larguraMmRegiao = Number(
      Math.abs(cursorXMm - inicioPosMm.xMm).toFixed(2),
    );
    const alturaMmRegiao = Number(
      Math.abs(cursorYMm - inicioPosMm.yMm).toFixed(2),
    );

    setRetanguloAtualMm({
      xMm,
      yMm,
      larguraMm: larguraMmRegiao,
      alturaMm: alturaMmRegiao,
    });
  };

  const finalizarSelecao = () => {
    setDesenhando(false);
  };

  const iniciarEdicaoCampo = (campo: RegiaoCampo) => {
    const paginaDoCampo = campo.pagina || 1;

    let classif = campo.tipoClassificacao;
    if (classif === undefined) {
      const cAny = campo as unknown as Record<string, unknown>;
      if (cAny.ehIdentificadorInicio) {
        classif = TipoClassificacaoCampo.IdentificadorDocumento;
      } else if (cAny.ehIdentificadorPagina) {
        classif = TipoClassificacaoCampo.IdentificadorPagina;
      } else {
        classif = TipoClassificacaoCampo.Nenhum;
      }
    }

    const cAny = campo as unknown as Record<string, unknown>;
    setCampoEmEdicaoId(campo.id);
    setNomeCampo(campo.nomeCampo);
    setPaginaCampo(paginaDoCampo);
    setPaginaAtivaCanvas(paginaDoCampo);
    setTipoClassificacao(classif);
    setTextoEsperadoDocumento(
      campo.textoEsperadoDocumento ||
      (cAny.textoEsperadoInicio as string | undefined) ||
      "",
    );
    setTextoEsperadoPagina(campo.textoEsperadoPagina || "");
    setIdentificadorPagina(campo.identificadorPagina || "");
    setIdentificadorAnterior(campo.identificadorAnterior || "");
    setIdentificadorPosterior(campo.identificadorPosterior || "");
    setTipoDado(campo.tipoDado ?? TipoDadoCampo.Texto);

    setRetanguloAtualMm({
      xMm: campo.xMm,
      yMm: campo.yMm,
      larguraMm: campo.larguraMm,
      alturaMm: campo.alturaMm,
    });
  };

  const cancelarEdicaoCampo = () => {
    setCampoEmEdicaoId(null);
    setNomeCampo("");
    setPaginaCampo(paginaAtivaCanvas);
    setTipoClassificacao(TipoClassificacaoCampo.Nenhum);
    setTextoEsperadoDocumento("");
    setTextoEsperadoPagina("");
    setIdentificadorPagina("");
    limparConfiguracaoValor();
    setRetanguloAtualMm(null);
  };

  const limparConfiguracaoValor = () => {
    setIdentificadorAnterior("");
    setIdentificadorPosterior("");
    setTipoDado(TipoDadoCampo.Texto);
  };

  const mudarClassificacao = (novoTipo: TipoClassificacaoCampo) => {
    setTipoClassificacao(novoTipo);
    if (novoTipo !== TipoClassificacaoCampo.Nenhum) {
      limparConfiguracaoValor();
      setIdentificadorPagina("");
    }
  };

  const identificadoresDePaginaDisponiveis = Array.from(
    new Set(
      campos
        .filter(
          (c) =>
            c.tipoClassificacao === TipoClassificacaoCampo.IdentificadorPagina,
        )
        .map((c) => c.nomeCampo.trim())
        .filter((nome) => Boolean(nome)),
    ),
  );

  const salvarRegiaoCampo = () => {
    if (
      !retanguloAtualMm ||
      retanguloAtualMm.larguraMm < 2 ||
      retanguloAtualMm.alturaMm < 2
    ) {
      exibirMensagem(
        "aviso",
        "Região Inválida",
        "Desenhe ou selecione uma região válida sobre o documento.",
      );
      return;
    }
    if (!nomeCampo.trim()) {
      exibirMensagem("aviso", "Campo Obrigatório", "Informe o nome do campo.");
      return;
    }
    if (
      campos.some(
        (c) =>
          c.nomeCampo.toLowerCase() === nomeCampo.trim().toLowerCase() &&
          c.id !== campoEmEdicaoId,
      )
    ) {
      exibirMensagem(
        "aviso",
        "Nome Duplicado",
        "Já existe um campo com este nome. Escolha outro.",
      );
      return;
    }

    if (tipoClassificacao === TipoClassificacaoCampo.IdentificadorDocumento) {
      if (!textoEsperadoDocumento.trim()) {
        exibirMensagem(
          "aviso",
          "Texto Obrigatório",
          "Informe o texto esperado para o Identificador de Documento.",
        );
        return;
      }
    } else if (
      tipoClassificacao === TipoClassificacaoCampo.IdentificadorPagina
    ) {
      if (!textoEsperadoPagina.trim()) {
        exibirMensagem(
          "aviso",
          "Texto Obrigatório",
          "Informe o texto esperado para o Identificador de Página.",
        );
        return;
      }
    } else {
      if (identificadoresDePaginaDisponiveis.length === 0) {
        exibirMensagem(
          "aviso",
          "Identificador de Página Ausente",
          "Cadastre primeiro um 'Identificador de página' no layout (ex: Identificação, Débitos, Resumo) antes de cadastrar campos normais.",
        );
        return;
      }
      if (!identificadorPagina.trim()) {
        exibirMensagem(
          "aviso",
          "Campo Obrigatório",
          "Selecione a qual Identificador de página este campo pertence.",
        );
        return;
      }
    }

    const ehCampoNormal = tipoClassificacao === TipoClassificacaoCampo.Nenhum;

    const payloadCampo: RegiaoCampo = {
      id: campoEmEdicaoId || gerarId(),
      nomeCampo: nomeCampo.trim(),
      pagina: Number(paginaCampo),
      xMm: retanguloAtualMm.xMm,
      yMm: retanguloAtualMm.yMm,
      larguraMm: retanguloAtualMm.larguraMm,
      alturaMm: retanguloAtualMm.alturaMm,
      tipoClassificacao,
      textoEsperadoDocumento:
        tipoClassificacao === TipoClassificacaoCampo.IdentificadorDocumento
          ? textoEsperadoDocumento.trim()
          : undefined,
      textoEsperadoPagina:
        tipoClassificacao === TipoClassificacaoCampo.IdentificadorPagina
          ? textoEsperadoPagina.trim()
          : undefined,
      identificadorPagina: ehCampoNormal
        ? identificadorPagina.trim()
        : undefined,
      identificadorAnterior:
        ehCampoNormal && identificadorAnterior.trim()
          ? identificadorAnterior.trim()
          : undefined,
      identificadorPosterior:
        ehCampoNormal && identificadorPosterior.trim()
          ? identificadorPosterior.trim()
          : undefined,
      tipoDado: ehCampoNormal ? tipoDado : TipoDadoCampo.Texto,
    };

    const novosCampos = campoEmEdicaoId
      ? campos.map((c) => (c.id === campoEmEdicaoId ? payloadCampo : c))
      : [...campos, payloadCampo];
    setCampos(novosCampos);
    cancelarEdicaoCampo();
  };

  const removerRegiaoCampo = (id: string, nome: string) => {
    exibirConfirmacao(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir o campo "${nome}"?`,
      () => {
        setCampos(campos.filter((c) => c.id !== id));
        if (campoEmEdicaoId === id) cancelarEdicaoCampo();
      },
    );
  };

  const cancelarEdicaoQuery = () => {
    setQueryEmEdicaoId(null);
    setNomeQuery("");
    setSqlQuery("");
    setSqlAnalisado(false);
    setParametrosEncontrados([]);
    setCamposRetornados([]);
    setRegrasAtuais([]);
    setRegraCampoRetornado("");
    setRegraCampoCarne("");
  };

  const executarAnaliseSQL = (
    textoSql: string,
    exibirAvisos = true,
  ): { sucesso: boolean; params: string[]; retornos: string[] } => {
    const texto = textoSql.trim();
    if (!texto) {
      if (exibirAvisos) {
        exibirMensagem("aviso", "SQL vazio", "Informe a instrução SQL.");
      }
      return { sucesso: false, params: [], retornos: [] };
    }

    const motivoBloqueio = verificarSomenteSelect(texto);
    if (motivoBloqueio) {
      if (exibirAvisos) {
        exibirMensagem("aviso", "Bloqueio de Segurança", motivoBloqueio);
      }
      return { sucesso: false, params: [], retornos: [] };
    }

    const regexParam = /\$([a-zA-Z0-9_]+)/g;
    const params: string[] = [];
    let match;
    while ((match = regexParam.exec(texto)) !== null) {
      params.push(match[1]);
    }
    const paramsUnicos = [...new Set(params)];

    const nomesDosCampos = campos.map((c) => c.nomeCampo);
    const parametrosInvalidos = paramsUnicos.filter(
      (p) => !nomesDosCampos.includes(p),
    );
    if (parametrosInvalidos.length > 0) {
      if (exibirAvisos) {
        exibirMensagem(
          "aviso",
          "Parâmetros inválidos",
          `Os seguintes parâmetros não existem nos campos do layout: ${parametrosInvalidos.join(", ")}`,
        );
      }
      return { sucesso: false, params: [], retornos: [] };
    }

    const regexRetorno = /\bAS\s+([a-zA-Z0-9_]+)/gi;
    const rets: string[] = [];
    while ((match = regexRetorno.exec(texto)) !== null) {
      rets.push(match[1]);
    }
    const retsUnicos = [...new Set(rets)];

    if (retsUnicos.length === 0) {
      if (exibirAvisos) {
        exibirMensagem(
          "aviso",
          "Campo inválido",
          "Não foi possível identificar os campos de retorno. Utilize 'AS NomeVariavel' na query para especificar as colunas.",
        );
      }
      return { sucesso: false, params: [], retornos: [] };
    }

    setParametrosEncontrados(paramsUnicos);
    setCamposRetornados(retsUnicos);
    setSqlAnalisado(true);

    if (retsUnicos.length > 0) {
      setRegraCampoRetornado(retsUnicos[0]);
    }

    if (camposNormaisDisponiveis.length > 0) {
      setRegraCampoCarne(camposNormaisDisponiveis[0].nomeCampo);
    }

    return { sucesso: true, params: paramsUnicos, retornos: retsUnicos };
  };

  const analisarQuerySQL = async () => {
    const textoSql = sqlQuery.trim();
    if (!textoSql) {
      exibirMensagem("aviso", "SQL vazio", "Informe a instrução SQL.");
      return;
    }

    const motivoBloqueio = verificarSomenteSelect(textoSql);
    if (motivoBloqueio) {
      exibirMensagem("aviso", "Bloqueio de Segurança", motivoBloqueio);
      return;
    }

    setAnalisandoSql(true);
    try {
      const resultado = await layoutService.validarSql(textoSql);
      // O usuário pode ter editado a query enquanto a análise estava em andamento
      if (sqlQueryAtualRef.current.trim() !== textoSql) return;

      if (!resultado.valida) {
        exibirMensagem(
          "aviso",
          "Erro na instrução SQL",
          resultado.erros
            .map((e) => `Linha ${e.linha}, coluna ${e.coluna}: ${e.mensagem}`)
            .join("\n"),
        );
        return;
      }
    } catch {
      exibirMensagem(
        "erro",
        "Falha na análise",
        "Não foi possível verificar a instrução SQL no servidor. Tente novamente.",
      );
      return;
    } finally {
      setAnalisandoSql(false);
    }

    executarAnaliseSQL(textoSql, true);
  };

  const adicionarRegraValidacao = () => {
    if (!regraCampoRetornado || !regraCampoCarne) {
      exibirMensagem(
        "aviso",
        "Campos ausentes",
        "Selecione os campos para criar a validação.",
      );
      return;
    }
    const novaRegra: RegraValidacao = {
      id: gerarId(),
      campoRetornado: regraCampoRetornado,
      operador: regraOperador,
      campoCarne: regraCampoCarne,
    };
    setRegrasAtuais([...regrasAtuais, novaRegra]);
  };

  const removerRegraValidacao = (id: string) => {
    setRegrasAtuais(regrasAtuais.filter((r) => r.id !== id));
  };

  const salvarQueryCompleta = () => {
    if (!nomeQuery.trim()) {
      exibirMensagem(
        "aviso",
        "Query sem nome",
        "Informe um nome para a Query de Validação.",
      );
      return;
    }
    if (!sqlAnalisado) {
      exibirMensagem(
        "aviso",
        "Analise pendente",
        "Você precisa analisar a instrução SQL antes de salvar.",
      );
      return;
    }

    const payload: QueryValidacao = {
      id: queryEmEdicaoId || gerarId(),
      nome: nomeQuery.trim(),
      sql: sqlQuery.trim(),
      parametrosEncontrados,
      camposRetornados,
      regras: regrasAtuais,
    };

    const novas = queryEmEdicaoId
      ? queries.map((q) => (q.id === queryEmEdicaoId ? payload : q))
      : [...queries, payload];
    setQueries(novas);
    cancelarEdicaoQuery();
  };

  const removerQuery = (id: string, nome: string) => {
    exibirConfirmacao(
      "Confirmar Exclusão",
      `Deseja remover a query "${nome}" e todas as suas validações associadas?`,
      () => {
        setQueries(queries.filter((q) => q.id !== id));
      },
    );
  };

  const editarQuery = (query: QueryValidacao) => {
    setQueryEmEdicaoId(query.id);
    setNomeQuery(query.nome);
    setSqlQuery(query.sql);
    setRegrasAtuais(query.regras || []);

    const resultado = executarAnaliseSQL(query.sql, false);

    if (resultado.sucesso) {
      if (resultado.retornos.length > 0) {
        setRegraCampoRetornado(resultado.retornos[0]);
      }
    } else {
      const params = query.parametrosEncontrados ?? [];
      const retornos = query.camposRetornados ?? [];
      setParametrosEncontrados(params);
      setCamposRetornados(retornos);
      setSqlAnalisado(true);
      if (retornos.length > 0) setRegraCampoRetornado(retornos[0]);
    }

    if (camposNormaisDisponiveis.length > 0) {
      setRegraCampoCarne(camposNormaisDisponiveis[0].nomeCampo);
    }
  };

  return (
    <div id="container-parametrizacao" className="row">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={lidarComArquivoModelo}
        className="d-none"
      ></input>
      <input
        ref={arquivoLayoutInputRef}
        type="file"
        accept=".json,application/json"
        onChange={lidarComArquivoLayout}
        className="d-none"
      ></input>

      <div className="col">
        <div className="box-form-cadastro">
          <Painel
            id="cabecalho-seletor-global"
            titulo="Layout"
            className="painel-seletor-layout"
          >
            <div className="row align-items-end">
              <div className="col-lg-6">
                <label htmlFor="select-layout-global">Layout</label>
                <select
                  id="select-layout-global"
                  className="form-control"
                  value={layoutSelecionadoId}
                  onChange={(e) => carregarLayout(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {layoutsSalvos.map((layout) => (
                    <option key={layout.nomeModelo} value={layout.nomeModelo}>
                      {layout.nomeModelo} ({layout.cliente})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-lg-6 text-right acoes-seletor-layout">
                {criandoNovoLayout ? (
                  <button
                    type="button"
                    onClick={cancelarCriacaoNovoLayout}
                    title="Descartar alterações"
                    className="btn btn-cancel"
                  >
                    <i className="fa fa-ban"></i> Cancelar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={removerLayoutAtual}
                    disabled={!layoutSelecionadoId}
                    title={
                      !layoutSelecionadoId
                        ? "Selecione um layout para remover"
                        : `Excluir o layout "${layoutSelecionadoId}"`
                    }
                    className="btn btn-danger"
                  >
                    <i className="fas fa-trash"></i> Remover
                  </button>
                )}

                {!criandoNovoLayout && (
                  <button
                    type="button"
                    onClick={exportarLayoutAtual}
                    disabled={!layoutSelecionadoId || houveAlteracao}
                    title={
                      !layoutSelecionadoId
                        ? "Selecione um layout para exportar"
                        : houveAlteracao
                          ? "Salve as alterações antes de exportar o layout"
                          : `Exportar o layout "${layoutSelecionadoId}" para um arquivo`
                    }
                    className="btn btn-primary ml-2"
                  >
                    <i className="fas fa-file-export"></i> Exportar
                  </button>
                )}

                {!criandoNovoLayout && (
                  <div
                    className="dropdown-hover ml-2"
                    onMouseEnter={() => setModalNovoLayoutAberto(true)}
                    onMouseLeave={() => setModalNovoLayoutAberto(false)}
                  >
                    <button
                      type="button"
                      disabled={carregandoPdfModelo || importandoLayout}
                      className="btn btn-primary"
                    >
                      <i
                        className={
                          carregandoPdfModelo || importandoLayout
                            ? "fas fa-spinner fa-spin"
                            : "fas fa-plus"
                        }
                      ></i>{" "}
                      {carregandoPdfModelo || importandoLayout
                        ? "Processando..."
                        : "Novo"}{" "}
                      <i className="fas fa-caret-down"></i>
                    </button>
                    {modalNovoLayoutAberto && (
                      <div className="dropdown-menu show">
                        <a
                          className="dropdown-item"
                          onClick={iniciarCriacaoManual}
                        >
                          <i className="fas fa-pen-square"></i>Criar manualmente
                        </a>
                        <a
                          className="dropdown-item"
                          onClick={dispararUploadModelo}
                        >
                          <i className="fas fa-file-import"></i>Importar modelo
                          (PDF)
                        </a>
                        <a
                          className="dropdown-item"
                          onClick={dispararImportacaoLayout}
                        >
                          <i className="fas fa-file-code"></i>Importar layout
                          (JSON)
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Painel>

          <Painel
            id="accordion-layout"
            titulo="1. Configurações do documento"
            resumo={
              nomeArquivoModelo ? `Modelo: ${nomeArquivoModelo}` : undefined
            }
            aberto={etapaAberta === "layout" && !semLayoutSelecionado}
            desabilitado={semLayoutSelecionado || emModoEdicao}
            aoAlternar={() => {
              if (!semLayoutSelecionado && !emModoEdicao)
                alternarEtapa("layout");
            }}
          >
            <div className="row">
              <div className="col-lg-4">
                <label htmlFor="select-cliente-layout">
                  Cliente
                  <span className="required-star"></span>
                </label>
                <select
                  id="select-cliente-layout"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="form-control"
                >
                  {CLIENTES_DISPONIVEIS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-8">
                <label htmlFor="input-nome-layout">
                  Nome do Layout
                  <span className="required-star"></span>
                </label>
                <input
                  id="input-nome-layout"
                  type="text"
                  value={nomeModelo}
                  onChange={(e) => setNomeModelo(e.target.value)}
                  placeholder="Ex: IPTU Padrão 2026"
                  className="form-control"
                ></input>
              </div>
            </div>
            <div className="row">
              <div className="col-lg-4">
                <label htmlFor="input-largura-layout">Largura (mm)</label>
                <input
                  id="input-largura-layout"
                  type="number"
                  value={larguraMm}
                  onChange={(e) => setLarguraMm(Number(e.target.value))}
                  className="form-control"
                ></input>
              </div>
              <div className="col-lg-4">
                <label htmlFor="input-altura-layout">Altura (mm)</label>
                <input
                  id="input-altura-layout"
                  type="number"
                  value={alturaMm}
                  onChange={(e) => setAlturaMm(Number(e.target.value))}
                  className="form-control"
                ></input>
              </div>
            </div>
          </Painel>

          <Painel
            id="accordion-campos"
            titulo="2. Mapeamento dos campos"
            resumo={`${campos.length} campos parametrizados`}
            aberto={etapaAberta === "campos" && !semLayoutSelecionado}
            desabilitado={
              semLayoutSelecionado || (emModoEdicao && etapaAberta !== "campos")
            }
            aoAlternar={() => {
              if (!semLayoutSelecionado && !emModoEdicao)
                alternarEtapa("campos");
            }}
          >
            <div className="row">
              <div id="coluna-canvas-documento" className="col-lg-8">
                <div
                  id="barra-navegacao-paginas-canvas"
                  className="barra-canvas"
                >
                  <span className="barra-canvas-dimensoes">
                    <i className="fas fa-ruler-combined"></i> {larguraMm} x{" "}
                    {alturaMm} (mm)
                  </span>
                  {paginasModelo.length > 0 && (
                    <span className="barra-canvas-grupo">
                      <span>Opacidade</span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={opacidadeModelo}
                        onChange={(e) =>
                          setOpacidadeModelo(Number(e.target.value))
                        }
                        className="custom-range barra-canvas-opacidade"
                      ></input>
                      <span>{opacidadeModelo}%</span>
                    </span>
                  )}
                  <span className="barra-canvas-grupo">
                    <button
                      type="button"
                      title="Diminuir zoom"
                      onClick={() => setZoomNivel(Math.max(10, zoomNivel - 15))}
                      className="btn btn-cancel btn-xxs"
                    >
                      <i className="fas fa-search-minus"></i>
                    </button>
                    <span
                      title="Zoom do documento"
                      className="barra-canvas-zoom"
                    >
                      {zoomNivel}%
                    </span>
                    <button
                      type="button"
                      title="Aumentar zoom"
                      onClick={() =>
                        setZoomNivel(Math.min(500, zoomNivel + 15))
                      }
                      className="btn btn-cancel btn-xxs"
                    >
                      <i className="fas fa-search-plus"></i>
                    </button>
                  </span>
                  <span className="barra-canvas-grupo">
                    {Array.from(
                      {
                        length: Math.max(
                          paginasModelo.length || 1,
                          paginaCampo,
                          ...campos.map((c) => c.pagina || 1),
                        ),
                      },
                      (_, i) => i + 1,
                    ).map((numPagina) => {
                      const estaAtiva = paginaAtivaCanvas === numPagina;
                      const qtdCamposNestaPagina = campos.filter(
                        (c) => (c.pagina || 1) === numPagina,
                      ).length;
                      return (
                        <button
                          key={numPagina}
                          type="button"
                          onClick={() => {
                            setPaginaAtivaCanvas(numPagina);
                            setPaginaCampo(numPagina);
                            setRetanguloAtualMm(null);
                          }}
                          className={`btn btn-xxs ${estaAtiva ? "btn-primary" : "btn-light"}`}
                        >
                          Página {numPagina}
                          {qtdCamposNestaPagina > 0 && (
                            <span
                              className={`badge ml-1 ${estaAtiva ? "badge-light" : "badge-secondary"}`}
                            >
                              {qtdCamposNestaPagina}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </span>
                </div>

                <div
                  id="caixa-viewport-documento"
                  ref={viewportRef}
                  className="viewport-documento"
                >
                  <div
                    id="canvas-area-demarcacao"
                    ref={containerRef}
                    onMouseDown={iniciarSelecao}
                    onMouseMove={atualizandoSelecao}
                    onMouseUp={finalizarSelecao}
                    className="canvas-demarcacao"
                    style={{
                      width: `${larguraVisualPx}px`,
                      height: `${alturaVisualPx}px`,
                      minWidth: `${larguraVisualPx}px`,
                      minHeight: `${alturaVisualPx}px`,
                    }}
                  >
                    {paginasModelo.length >= paginaAtivaCanvas ? (
                      <img
                        src={paginasModelo[paginaAtivaCanvas - 1]}
                        alt={`Gabarito - Página ${paginaAtivaCanvas}`}
                        className="canvas-imagem-modelo"
                        style={{ opacity: opacidadeModelo / 100 }}
                      ></img>
                    ) : (
                      <div className="canvas-sem-modelo">
                        <span>PREFEITURA MUNICIPAL — GUIA ARRECADATÓRIA</span>
                      </div>
                    )}

                    {campos
                      .filter(
                        (campo) => (campo.pagina || 1) === paginaAtivaCanvas,
                      )
                      .map((campo) => {
                        const ativo = campo.id === campoEmEdicaoId;
                        const ehDocId =
                          campo.tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorDocumento;
                        const ehPagId =
                          campo.tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorPagina;

                        return (
                          <div
                            key={campo.id}
                            id={`box-campo-${campo.id}`}
                            className={`caixa-campo ${ativo
                                ? "caixa-campo-ativo"
                                : ehDocId
                                  ? "caixa-campo-documento"
                                  : ehPagId
                                    ? "caixa-campo-pagina"
                                    : ""
                              }`}
                            style={{
                              left: `${campo.xMm * escalaPxPorMm}px`,
                              top: `${campo.yMm * escalaPxPorMm}px`,
                              width: `${campo.larguraMm * escalaPxPorMm}px`,
                              height: `${campo.alturaMm * escalaPxPorMm}px`,
                            }}
                          >
                            {ehDocId && <i className="fas fa-flag mr-1"></i>}
                            {ehPagId && (
                              <i className="fas fa-thumbtack mr-1"></i>
                            )}
                            {ehDocId
                              ? `[DOC] ${campo.nomeCampo}`
                              : ehPagId
                                ? `[PÁG] ${campo.nomeCampo}`
                                : campo.nomeCampo}
                          </div>
                        );
                      })}

                    {retanguloAtualMm && paginaCampo === paginaAtivaCanvas && (
                      <div
                        id="retangulo-selecao-ativa"
                        className="retangulo-selecao"
                        style={{
                          left: `${retanguloAtualMm.xMm * escalaPxPorMm}px`,
                          top: `${retanguloAtualMm.yMm * escalaPxPorMm}px`,
                          width: `${retanguloAtualMm.larguraMm * escalaPxPorMm}px`,
                          height: `${retanguloAtualMm.alturaMm * escalaPxPorMm}px`,
                        }}
                      ></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-lg-4 coluna-edicao-campo">
                <Painel
                  titulo={campoEmEdicaoId ? "Editar campo" : "Criar campo"}
                  className="painel-interno"
                  resumo={
                    campoEmEdicaoId && (
                      <button
                        type="button"
                        className="btn btn-link btn-xxs p-0"
                        onClick={cancelarEdicaoCampo}
                      >
                        <i className="fa fa-ban"></i> Cancelar edição
                      </button>
                    )
                  }
                >
                  <label>
                    Classificação do campo
                    <span className="required-star"></span>
                  </label>
                  <div className="opcoes-classificacao">
                    <div className="custom-control custom-radio">
                      <input
                        type="radio"
                        id="radio-classificacao-documento"
                        name="classificacaoCampo"
                        className="custom-control-input"
                        checked={
                          tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorDocumento
                        }
                        onChange={() =>
                          mudarClassificacao(
                            TipoClassificacaoCampo.IdentificadorDocumento,
                          )
                        }
                      ></input>
                      <label
                        className="custom-control-label"
                        htmlFor="radio-classificacao-documento"
                      >
                        Identificador de documento
                      </label>
                    </div>

                    <div className="custom-control custom-radio">
                      <input
                        type="radio"
                        id="radio-classificacao-pagina"
                        name="classificacaoCampo"
                        className="custom-control-input"
                        checked={
                          tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorPagina
                        }
                        onChange={() =>
                          mudarClassificacao(
                            TipoClassificacaoCampo.IdentificadorPagina,
                          )
                        }
                      ></input>
                      <label
                        className="custom-control-label"
                        htmlFor="radio-classificacao-pagina"
                      >
                        Identificador de página
                      </label>
                    </div>

                    <div className="custom-control custom-radio">
                      <input
                        type="radio"
                        id="radio-classificacao-comum"
                        name="classificacaoCampo"
                        className="custom-control-input"
                        checked={
                          tipoClassificacao === TipoClassificacaoCampo.Nenhum
                        }
                        onChange={() =>
                          mudarClassificacao(TipoClassificacaoCampo.Nenhum)
                        }
                      ></input>
                      <label
                        className="custom-control-label"
                        htmlFor="radio-classificacao-comum"
                      >
                        Campo comum
                      </label>
                    </div>
                  </div>

                  <label htmlFor="input-nome-campo">
                    Nome do campo
                    <span className="required-star"></span>
                  </label>
                  <input
                    id="input-nome-campo"
                    type="text"
                    value={nomeCampo}
                    onChange={(e) => setNomeCampo(e.target.value)}
                    placeholder={
                      tipoClassificacao ===
                        TipoClassificacaoCampo.IdentificadorPagina
                        ? "Ex: Débitos, Identificação, Resumo"
                        : "Ex: Total, Contribuinte, Inscrição"
                    }
                    className="form-control"
                  ></input>

                  {tipoClassificacao ===
                    TipoClassificacaoCampo.IdentificadorDocumento && (
                      <div className="bloco-identificador bloco-identificador-documento">
                        <label htmlFor="input-texto-esperado-documento">
                          <i className="fas fa-flag mr-1"></i>
                          Texto esperado no documento
                        </label>
                        <input
                          id="input-texto-esperado-documento"
                          type="text"
                          value={textoEsperadoDocumento}
                          onChange={(e) =>
                            setTextoEsperadoDocumento(e.target.value)
                          }
                          placeholder="Ex: PREFEITURA MUNICIPAL"
                          className="form-control"
                        ></input>
                        <small className="form-text text-muted">
                          Texto que identifica onde o carnê começa/termina no PDF.
                        </small>
                      </div>
                    )}

                  {tipoClassificacao ===
                    TipoClassificacaoCampo.IdentificadorPagina && (
                      <div className="bloco-identificador bloco-identificador-pagina">
                        <label htmlFor="input-texto-esperado-pagina">
                          <i className="fas fa-thumbtack mr-1"></i>
                          Texto esperado na página
                        </label>
                        <input
                          id="input-texto-esperado-pagina"
                          type="text"
                          value={textoEsperadoPagina}
                          onChange={(e) => setTextoEsperadoPagina(e.target.value)}
                          placeholder="Ex: DEMONSTRATIVO DE DÉBITOS"
                          className="form-control"
                        ></input>
                        <small className="form-text text-muted">
                          Texto que comprova que a página é deste tipo.
                        </small>
                      </div>
                    )}

                  {tipoClassificacao === TipoClassificacaoCampo.Nenhum && (
                    <>
                      <label htmlFor="select-identificador-pagina">
                        Identificador de página
                      </label>
                      <select
                        id="select-identificador-pagina"
                        value={identificadorPagina}
                        onChange={(e) => setIdentificadorPagina(e.target.value)}
                        className="form-control"
                      >
                        <option value="">Selecione</option>
                        {identificadoresDePaginaDisponiveis.map((idPag) => (
                          <option key={idPag} value={idPag}>
                            {idPag}
                          </option>
                        ))}
                      </select>
                      {identificadoresDePaginaDisponiveis.length === 0 && (
                        <small className="form-text text-danger">
                          Nenhum identificador de página cadastrado. Cadastre um
                          primeiro marcando a opção acima.
                        </small>
                      )}

                      <label htmlFor="input-identificador-anterior">
                        Identificador anterior (opcional)
                      </label>
                      <input
                        id="input-identificador-anterior"
                        type="text"
                        value={identificadorAnterior}
                        onChange={(e) =>
                          setIdentificadorAnterior(e.target.value)
                        }
                        placeholder="Ex: TOTAL:, VALOR:"
                        className="form-control"
                      ></input>
                      <small className="form-text text-muted">
                        Texto que precede o valor dentro da área. Se não for
                        localizado, o campo é considerado ausente.
                      </small>

                      <label htmlFor="input-identificador-posterior">
                        Identificador posterior (opcional)
                      </label>
                      <input
                        id="input-identificador-posterior"
                        type="text"
                        value={identificadorPosterior}
                        onChange={(e) =>
                          setIdentificadorPosterior(e.target.value)
                        }
                        placeholder="Ex: InscrMunicipal, VENCIMENTO"
                        className="form-control"
                      ></input>
                      <small className="form-text text-muted">
                        Texto que encerra o valor. Se não for localizado, o
                        valor vai até o fim da área.
                      </small>

                      <label htmlFor="select-tipo-dado">Tipo de dado</label>
                      <select
                        id="select-tipo-dado"
                        value={tipoDado}
                        onChange={(e) =>
                          setTipoDado(Number(e.target.value) as TipoDadoCampo)
                        }
                        className="form-control"
                      >
                        {OPCOES_TIPO_DADO.map((opcao) => (
                          <option key={opcao.valor} value={opcao.valor}>
                            {opcao.exemplo &&
                              opcao.valor !== TipoDadoCampo.Texto
                              ? `${opcao.rotulo} (ex: ${opcao.exemplo})`
                              : opcao.rotulo}
                          </option>
                        ))}
                      </select>
                      <small className="form-text text-muted">
                        {tipoDado === TipoDadoCampo.Texto
                          ? "Usa todo o texto entre os identificadores."
                          : "Usa o primeiro trecho no formato escolhido. Se nenhum for encontrado, o valor é marcado como inválido e as consultas que o utilizam não são executadas."}
                      </small>
                    </>
                  )}

                  {retanguloAtualMm && (
                    <div className="coordenadas-campo">
                      <strong>Coordenadas (mm):</strong> Pg: {paginaCampo} | X:{" "}
                      {retanguloAtualMm.xMm.toFixed(1)} | Y:{" "}
                      {retanguloAtualMm.yMm.toFixed(1)} | L:{" "}
                      {retanguloAtualMm.larguraMm.toFixed(1)} | A:{" "}
                      {retanguloAtualMm.alturaMm.toFixed(1)}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={salvarRegiaoCampo}
                    className="btn btn-primary btn-block mt-3"
                  >
                    <i
                      className={
                        campoEmEdicaoId ? "fas fa-check" : "fas fa-plus"
                      }
                    ></i>{" "}
                    {campoEmEdicaoId ? "Atualizar campo" : "Criar campo"}
                  </button>
                </Painel>

                <Painel
                  titulo="Campos do modelo"
                  className="painel-interno"
                  resumo={
                    <span className="badge badge-secondary">
                      {campos.length}
                    </span>
                  }
                >
                  {campos.length === 0 ? (
                    <p className="lista-itens-vazia">Nenhum campo demarcado.</p>
                  ) : (
                    <ul className="lista-itens lista-itens-rolavel">
                      {campos.map((c) => {
                        const ehDocId =
                          c.tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorDocumento;
                        const ehPagId =
                          c.tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorPagina;

                        return (
                          <li key={c.id} className="lista-itens-item">
                            <div className="lista-itens-texto">
                              <strong
                                className={
                                  ehDocId
                                    ? "texto-identificador-documento"
                                    : ehPagId
                                      ? "texto-identificador-pagina"
                                      : ""
                                }
                              >
                                {ehDocId && (
                                  <i className="fas fa-flag mr-1"></i>
                                )}
                                {ehPagId && (
                                  <i className="fas fa-thumbtack mr-1"></i>
                                )}
                                {ehDocId
                                  ? `[DOC] ${c.nomeCampo}`
                                  : ehPagId
                                    ? `[PÁG] ${c.nomeCampo}`
                                    : c.nomeCampo}
                              </strong>
                              <small>
                                {ehDocId &&
                                  `Identificador de Documento • "${c.textoEsperadoDocumento}"`}
                                {ehPagId &&
                                  `Identificador de Página • "${c.textoEsperadoPagina}"`}
                                {!ehDocId &&
                                  !ehPagId &&
                                  `Estrutura: ${c.identificadorPagina || "Sem vínculo"} • Pg ref: ${c.pagina} • ${c.larguraMm}x${c.alturaMm}mm`}
                                {c.identificadorAnterior &&
                                  ` • [Pré: "${c.identificadorAnterior}"]`}
                                {c.identificadorPosterior &&
                                  ` • [Pós: "${c.identificadorPosterior}"]`}
                                {!ehDocId &&
                                  !ehPagId &&
                                  c.tipoDado !== undefined &&
                                  c.tipoDado !== TipoDadoCampo.Texto &&
                                  ` • [Tipo: ${OPCOES_TIPO_DADO.find((o) => o.valor === c.tipoDado)?.rotulo ?? c.tipoDado}]`}
                              </small>
                            </div>
                            <div className="lista-itens-acoes">
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoCampo(c)}
                                title="Editar"
                                className="btn btn-primary btn-custom btn-xxs"
                              >
                                <i className="fas fa-pen"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  removerRegiaoCampo(c.id, c.nomeCampo)
                                }
                                title="Remover"
                                className="btn btn-danger btn-custom btn-xxs"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Painel>
              </div>
            </div>
          </Painel>

          <Painel
            id="accordion-validacoes"
            titulo="3. Regras de validação"
            resumo={`${queries.length} validações ativas`}
            aberto={etapaAberta === "validacoes" && !semLayoutSelecionado}
            desabilitado={
              semLayoutSelecionado ||
              (emModoEdicao && etapaAberta !== "validacoes")
            }
            aoAlternar={() => {
              if (!semLayoutSelecionado && !emModoEdicao)
                alternarEtapa("validacoes");
            }}
          >
            <div className="row">
              <div className="col-lg-8">
                <Painel
                  titulo={
                    queryEmEdicaoId ? "Editar validação" : "Nova validação"
                  }
                  className="painel-interno"
                >
                  <label htmlFor="input-nome-validacao">
                    Nome
                    <span className="required-star"></span>
                  </label>
                  <input
                    id="input-nome-validacao"
                    type="text"
                    value={nomeQuery}
                    onChange={(e) => setNomeQuery(e.target.value)}
                    placeholder="Ex: Nome do contribuinte"
                    className="form-control"
                  ></input>

                  <label>
                    Regra para validar
                    <span className="required-star"></span>
                  </label>
                  <SqlCodeEditor
                    value={sqlQuery}
                    onChange={(novoSql) => {
                      setSqlQuery(novoSql);
                      setSqlAnalisado(false);
                    }}
                    camposDisponiveis={campos.map((c) => c.nomeCampo)}
                  ></SqlCodeEditor>

                  <div
                    id="container-botao-analisar"
                    className="text-right mt-2"
                  >
                    <button
                      type="button"
                      onClick={analisarQuerySQL}
                      disabled={analisandoSql}
                      className="btn btn-primary"
                    >
                      <i
                        className={
                          analisandoSql
                            ? "fas fa-spinner fa-spin"
                            : "fas fa-search"
                        }
                      ></i>{" "}
                      {analisandoSql ? "Analisando..." : "Analisar"}
                    </button>
                  </div>

                  {sqlAnalisado && (
                    <div className="analise-sql">
                      <div className="row">
                        <div className="col">
                          <label>Parâmetros de entrada ($)</label>
                          <div>
                            {parametrosEncontrados.length > 0 ? (
                              parametrosEncontrados.map((p) => (
                                <span key={p} className="tag-padrao">
                                  {p.includes(" ") ? `\${${p}}` : `$${p}`}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted">Nenhum</span>
                            )}
                          </div>
                        </div>
                        <div className="col">
                          <label>Retornos apurados (AS)</label>
                          <div>
                            {camposRetornados.length > 0 ? (
                              camposRetornados.map((c) => (
                                <span
                                  key={c}
                                  className="tag-padrao tag-retorno"
                                >
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted">Nenhum</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="row align-items-end">
                        <div className="col">
                          <label htmlFor="select-regra-campo-retornado">
                            Campo retornado (banco)
                          </label>
                          <select
                            id="select-regra-campo-retornado"
                            value={regraCampoRetornado}
                            onChange={(e) =>
                              setRegraCampoRetornado(e.target.value)
                            }
                            className="form-control"
                          >
                            {camposRetornados.map((cr) => (
                              <option key={cr} value={cr}>
                                {cr}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-auto">
                          <label htmlFor="select-regra-operador">
                            Operador
                          </label>
                          <select
                            id="select-regra-operador"
                            value={regraOperador}
                            onChange={(e) => setRegraOperador(e.target.value)}
                            className="form-control"
                          >
                            <option value="=">=</option>
                            <option value="<>">&lt;&gt;</option>
                          </select>
                        </div>
                        <div className="col">
                          <label htmlFor="select-regra-campo-documento">
                            Campo no documento
                          </label>
                          <select
                            id="select-regra-campo-documento"
                            value={regraCampoCarne}
                            onChange={(e) => setRegraCampoCarne(e.target.value)}
                            className="form-control"
                          >
                            {camposNormaisDisponiveis.map((c) => (
                              <option key={c.id} value={c.nomeCampo}>
                                {c.nomeCampo}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-auto">
                          <button
                            type="button"
                            onClick={adicionarRegraValidacao}
                            className="btn btn-primary"
                          >
                            <i className="fas fa-link"></i> Vincular
                          </button>
                        </div>
                      </div>

                      <table className="table table-grid mt-3">
                        <thead>
                          <tr>
                            <th>Campo banco de dados</th>
                            <th className="text-center">Operador</th>
                            <th>Campo documento</th>
                            <th className="text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regrasAtuais.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="text-center text-muted"
                              >
                                Nenhuma regra configurada
                              </td>
                            </tr>
                          )}
                          {regrasAtuais.map((r) => (
                            <tr key={r.id}>
                              <td className="font-weight-bold">
                                {r.campoRetornado}
                              </td>
                              <td className="text-center font-weight-bold">
                                {r.operador}
                              </td>
                              <td className="font-weight-bold text-primary">
                                {r.campoCarne}
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  title="Remover regra"
                                  onClick={() => removerRegraValidacao(r.id)}
                                  className="btn btn-danger btn-custom btn-xxs"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="d-flex justify-content-end mt-3">
                        {queryEmEdicaoId && (
                          <button
                            type="button"
                            onClick={cancelarEdicaoQuery}
                            className="btn btn-cancel mr-2"
                          >
                            <i className="fa fa-ban"></i> Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={salvarQueryCompleta}
                          className="btn btn-primary"
                        >
                          <i className="fas fa-check"></i> Salvar validação
                        </button>
                      </div>
                    </div>
                  )}
                </Painel>
              </div>

              <div className="col-lg-4">
                <Painel
                  titulo="Validações configuradas"
                  className="painel-interno"
                  resumo={
                    <span className="badge badge-secondary">
                      {queries.length}
                    </span>
                  }
                >
                  {queries.length === 0 && (
                    <p className="lista-itens-vazia">
                      Nenhuma query configurada.
                    </p>
                  )}
                  {queries.length > 0 && (
                    <ul className="lista-itens">
                      {queries.map((q) => (
                        <li key={q.id} className="lista-itens-item">
                          <div className="lista-itens-texto">
                            <strong className="text-primary">{q.nome}</strong>
                            <small>{q.regras.length} regras vinculadas</small>
                          </div>
                          <div className="lista-itens-acoes">
                            <button
                              type="button"
                              onClick={() => editarQuery(q)}
                              title="Editar"
                              className="btn btn-primary btn-custom btn-xxs"
                            >
                              <i className="fas fa-pen"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => removerQuery(q.id, q.nome)}
                              title="Remover"
                              className="btn btn-danger btn-custom btn-xxs"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Painel>
              </div>
            </div>
          </Painel>

          <div id="rodape-salvar-tudo" className="row">
            <div className="btn-forms col">
              <button
                type="button"
                onClick={salvarTudo}
                disabled={
                  semLayoutSelecionado || emModoEdicao || !houveAlteracao
                }
                title={
                  semLayoutSelecionado
                    ? "Selecione ou crie um layout antes de salvar"
                    : emModoEdicao
                      ? "Finalize as edições pendentes antes de salvar tudo"
                      : !houveAlteracao
                        ? "Nenhuma alteração foi realizada para salvar"
                        : "Salvar todas as alterações"
                }
                className="btn btn-primary"
              >
                <i className="fas fa-check"></i> Salvar
              </button>
            </div>
          </div>
        </div>
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
