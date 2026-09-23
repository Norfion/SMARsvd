import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState, useRef, useEffect } from "react";
import { SqlCodeEditor } from "../components/SqlCodeEditor";
import { processarArquivoPdfModelo } from "../utils/pdfModelReader";
import {
  TipoClassificacaoCampo,
  type RegiaoCampo,
  type LayoutCliente,
  type QueryValidacao,
  type RegraValidacao,
} from "../types/layout";

interface ParametrizacaoPageProps {
  layoutsSalvos: LayoutCliente[];
  onSalvarLayouts: (layouts: LayoutCliente[]) => void;
  onExcluirLayout?: (idOuNome: string) => void;
  onHouveAlteracaoChange?: (houveAlteracao: boolean) => void;
}

export function ParametrizacaoPage({
  layoutsSalvos,
  onSalvarLayouts,
  onExcluirLayout,
  onHouveAlteracaoChange,
}: ParametrizacaoPageProps) {
  const CLIENTES_DISPONIVEIS = [
    "PM Sertãozinho - SP",
    "PM Serra - ES",
    "PM Birigui - SP",
    "PM Araraquara - SP",
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

  const [cliente, setCliente] = useState<string>("PM Sertãozinho - SP");
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

  // Filtra apenas campos normais (exclui identificador de documento e identificador de página)
  const camposNormaisDisponiveis = campos.filter(
    (c) =>
      c.tipoClassificacao === TipoClassificacaoCampo.Nenhum ||
      c.tipoClassificacao === undefined,
  );

  const [campoEmEdicaoId, setCampoEmEdicaoId] = useState<string | null>(null);
  const [nomeCampo, setNomeCampo] = useState("");
  const [paginaCampo, setPaginaCampo] = useState<number>(1);
  const [paginaAtivaCanvas, setPaginaAtivaCanvas] = useState<number>(1);

  // Estados dos novos identificadores
  const [tipoClassificacao, setTipoClassificacao] =
    useState<TipoClassificacaoCampo>(TipoClassificacaoCampo.Nenhum);
  const [textoEsperadoDocumento, setTextoEsperadoDocumento] = useState("");
  const [textoEsperadoPagina, setTextoEsperadoPagina] = useState("");
  const [identificadorPagina, setIdentificadorPagina] = useState("");
  const [identificadorAnterior, setIdentificadorAnterior] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const lidarComRodaMouse = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      setZoomNivel((nivelAtual) =>
        Math.min(300, Math.max(50, nivelAtual + delta)),
      );
    }
  };

  const [queries, setQueries] = useState<QueryValidacao[]>([]);
  const [queryEmEdicaoId, setQueryEmEdicaoId] = useState<string | null>(null);
  const [nomeQuery, setNomeQuery] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlAnalisado, setSqlAnalisado] = useState(false);
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
    setCliente("PM Sertãozinho - SP");
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
      setCliente("PM Sertãozinho - SP");
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

  const SENHA_EXCLUSAO = "teste123";

  const executarExclusaoFisicaLayout = () => {
    if (onExcluirLayout && layoutId) {
      onExcluirLayout(layoutId);
    } else if (!layoutId) {
      exibirMensagem(
        "erro",
        "Erro na exclusão",
        "Não foi possível localizar o ID deste layout para excluí-lo no banco.",
      );
      return;
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
        if (senhaRecebida !== SENHA_EXCLUSAO) {
          exibirMensagem(
            "aviso",
            "Senha Incorreta",
            "A senha digitada está incorreta. A exclusão foi cancelada.",
          );
          return;
        }
        executarExclusaoFisicaLayout();
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

    setLayoutId(layout.id);
    setLayoutSelecionadoId(layout.nomeModelo);
    setCliente(layout.cliente);
    setNomeModelo(layout.nomeModelo);
    setLarguraMm(layout.larguraPaginaMm);
    setAlturaMm(layout.alturaPaginaMm);

    // Compatibilidade com cadastros legados
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
    setIdentificadorAnterior("");
    setRetanguloAtualMm(null);
  };

  const mudarClassificacao = (novoTipo: TipoClassificacaoCampo) => {
    setTipoClassificacao(novoTipo);
    if (novoTipo === TipoClassificacaoCampo.IdentificadorDocumento) {
      setIdentificadorAnterior("");
      setIdentificadorPagina("");
    } else if (novoTipo === TipoClassificacaoCampo.IdentificadorPagina) {
      setIdentificadorAnterior("");
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

    const payloadCampo: RegiaoCampo = {
      id: campoEmEdicaoId || crypto.randomUUID(),
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
      identificadorPagina:
        tipoClassificacao === TipoClassificacaoCampo.Nenhum
          ? identificadorPagina.trim()
          : undefined,
      identificadorAnterior:
        tipoClassificacao === TipoClassificacaoCampo.Nenhum &&
        identificadorAnterior.trim()
          ? identificadorAnterior.trim()
          : undefined,
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

    const comandosBloqueados =
      /\b(UPDATE|DELETE|INSERT|EXEC|EXECUTE|DROP|ALTER|CREATE|TRUNCATE|MERGE)\b/i;
    if (comandosBloqueados.test(texto)) {
      if (exibirAvisos) {
        exibirMensagem(
          "aviso",
          "Bloqueio de Segurança",
          "São permitidas apenas consultas somente leitura (SELECT).",
        );
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

  const analisarQuerySQL = () => {
    executarAnaliseSQL(sqlQuery, true);
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
      id: crypto.randomUUID(),
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
      id: queryEmEdicaoId || crypto.randomUUID(),
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
    <div id="container-parametrizacao">
      <style>
        {`
          .accordion-content-wrapper { transition: max-height 0.35s ease, opacity 0.25s ease, padding 0.35s ease; overflow: hidden; }
          .accordion-content-open { max-height: 2000px; opacity: 1; padding: 16px; }
          .accordion-content-closed { max-height: 0; opacity: 0; padding: 0 16px; }
          input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type="number"] { -moz-appearance: textfield; }
        `}
      </style>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={lidarComArquivoModelo}
        style={{ display: "none" }}
      ></input>

      <div
        id="cabecalho-seletor-global"
        style={{
          backgroundColor: "#ffffff",
          padding: "12px 16px",
          borderRadius: "4px",
          border: "1px solid #cfd8dc",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: 1,
          }}
        >
          <div style={{ flex: 1, maxWidth: "420px" }}>
            <select
              id="select-layout-global"
              value={layoutSelecionadoId}
              onChange={(e) => carregarLayout(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #b0bec5",
                backgroundColor: "#ffffff",
                color: "#263238",
                fontWeight: 600,
                outline: "none",
                height: "32px",
              }}
            >
              <option value="">(Selecione um layout)</option>
              {layoutsSalvos.map((layout) => (
                <option key={layout.nomeModelo} value={layout.nomeModelo}>
                  {layout.nomeModelo} ({layout.cliente})
                </option>
              ))}
            </select>
          </div>
        </div>

        {criandoNovoLayout ? (
          <button
            type="button"
            onClick={cancelarCriacaoNovoLayout}
            title="Descartar alterações"
            style={{
              backgroundColor: "#ffebee",
              color: "#c62828",
              border: "1px solid #ffcdd2",
              padding: "6px 14px",
              borderRadius: "4px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "32px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              marginRight: "8px",
            }}
          >
            <span>Cancelar</span>
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
            style={{
              backgroundColor: !layoutSelecionadoId ? "#f5f5f5" : "#ffebee",
              color: !layoutSelecionadoId ? "#9e9e9e" : "#c62828",
              border: !layoutSelecionadoId
                ? "1px solid #e0e0e0"
                : "1px solid #ffcdd2",
              padding: "6px 14px",
              borderRadius: "4px",
              fontWeight: 700,
              cursor: !layoutSelecionadoId ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "32px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              marginRight: "8px",
            }}
          >
            <span>Remover</span>
          </button>
        )}

        {!criandoNovoLayout && (
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setModalNovoLayoutAberto(true)}
            onMouseLeave={() => setModalNovoLayoutAberto(false)}
          >
            <button
              type="button"
              disabled={carregandoPdfModelo}
              style={{
                backgroundColor: "#009688",
                color: "#ffffff",
                border: "none",
                padding: "6px 16px",
                borderRadius: "4px",
                fontWeight: 700,
                cursor: carregandoPdfModelo ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: "32px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <span>{carregandoPdfModelo ? "Processando..." : "Novo"}</span>
              <span style={{ fontSize: "0.65rem" }}>▼</span>
            </button>
            {modalNovoLayoutAberto && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  backgroundColor: "#ffffff",
                  border: "1px solid #b0bec5",
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  zIndex: 50,
                  width: "220px",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={iniciarCriacaoManual}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid #eceff1",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#37474f",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Criar Manualmente</span>
                </button>
                <button
                  type="button"
                  onClick={dispararUploadModelo}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#37474f",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Importar Modelo (PDF)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. CONFIGURAÇÕES DO DOCUMENTO */}
      <div
        id="accordion-layout"
        style={{
          marginBottom: "12px",
          backgroundColor: "#ffffff",
          border: "1px solid #cfd8dc",
          borderRadius: "4px",
          overflow: "hidden",
          opacity: semLayoutSelecionado || emModoEdicao ? 0.65 : 1,
        }}
      >
        <div
          onClick={() => {
            if (!semLayoutSelecionado && !emModoEdicao) alternarEtapa("layout");
          }}
          style={{
            backgroundColor: etapaAberta === "layout" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor:
              !semLayoutSelecionado && !emModoEdicao
                ? "pointer"
                : "not-allowed",
            borderBottom:
              etapaAberta === "layout" ? "1px solid #b2dfdb" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                color: etapaAberta === "layout" ? "#00796b" : "#546e7a",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              {etapaAberta === "layout" ? "▼" : "▶"}
            </span>
            <strong
              style={{
                fontSize: "0.9rem",
                color: etapaAberta === "layout" ? "#00796b" : "#263238",
              }}
            >
              1. Configurações do documento
            </strong>
          </div>
          {nomeArquivoModelo && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "#00796b",
                fontWeight: 600,
                backgroundColor: "#ffffff",
                padding: "2px 8px",
                borderRadius: "3px",
                border: "1px solid #b2dfdb",
              }}
            >
              Modelo: {nomeArquivoModelo}
            </span>
          )}
        </div>
        <div
          className={`accordion-content-wrapper ${etapaAberta === "layout" && !semLayoutSelecionado ? "accordion-content-open" : "accordion-content-closed"}`}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "16px",
              marginBottom: "14px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Cliente
              </label>
              <select
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                }}
              >
                {CLIENTES_DISPONIVEIS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Nome do Layout
              </label>
              <input
                type="text"
                value={nomeModelo}
                onChange={(e) => setNomeModelo(e.target.value)}
                placeholder="Ex: IPTU Padrão 2026"
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                }}
              ></input>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Largura (mm)
              </label>
              <input
                type="number"
                value={larguraMm}
                onChange={(e) => setLarguraMm(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                }}
              ></input>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Altura (mm)
              </label>
              <input
                type="number"
                value={alturaMm}
                onChange={(e) => setAlturaMm(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                }}
              ></input>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAPEAMENTO DOS CAMPOS */}
      <div
        id="accordion-campos"
        style={{
          marginBottom: "12px",
          backgroundColor: "#ffffff",
          border: "1px solid #cfd8dc",
          borderRadius: "4px",
          overflow: "hidden",
          opacity:
            semLayoutSelecionado || (emModoEdicao && etapaAberta !== "campos")
              ? 0.65
              : 1,
        }}
      >
        <div
          onClick={() => {
            if (!semLayoutSelecionado && !emModoEdicao) alternarEtapa("campos");
          }}
          style={{
            backgroundColor: etapaAberta === "campos" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor:
              !semLayoutSelecionado && !emModoEdicao
                ? "pointer"
                : "not-allowed",
            borderBottom:
              etapaAberta === "campos" ? "1px solid #b2dfdb" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                color: etapaAberta === "campos" ? "#00796b" : "#546e7a",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              {etapaAberta === "campos" ? "▼" : "▶"}
            </span>
            <strong
              style={{
                fontSize: "0.9rem",
                color: etapaAberta === "campos" ? "#00796b" : "#263238",
              }}
            >
              2. Mapeamento dos campos
            </strong>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#546e7a" }}>
            {campos.length} campos parametrizados
          </span>
        </div>
        <div
          className={`accordion-content-wrapper ${etapaAberta === "campos" && !semLayoutSelecionado ? "accordion-content-open" : "accordion-content-closed"}`}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div
              id="coluna-canvas-documento"
              style={{
                flex: "1 1 650px",
                maxWidth: "calc(100% - 340px)",
                minWidth: "320px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                id="barra-navegacao-paginas-canvas"
                style={{
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  backgroundColor: "#f5f7f8",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "#37474f",
                    fontSize: "0.75rem",
                  }}
                >
                  {larguraMm} x {alturaMm} (mm)
                </div>
                {paginasModelo.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#546e7a",
                        fontWeight: 600,
                      }}
                    >
                      Opacidade:
                    </span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={opacidadeModelo}
                      onChange={(e) =>
                        setOpacidadeModelo(Number(e.target.value))
                      }
                      style={{ width: "70px", cursor: "pointer" }}
                    ></input>
                    <span style={{ fontSize: "0.7rem", color: "#37474f" }}>
                      {opacidadeModelo}%
                    </span>
                  </div>
                )}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <button
                    type="button"
                    onClick={() => setZoomNivel(Math.max(10, zoomNivel - 15))}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "3px",
                      border: "1px solid #b0bec5",
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    -
                  </button>
                  <span
                    title="Zoom do documento"
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      minWidth: "36px",
                      textAlign: "center",
                      cursor: "help",
                    }}
                  >
                    {zoomNivel}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomNivel(Math.min(500, zoomNivel + 15))}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "3px",
                      border: "1px solid #b0bec5",
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
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
                        style={{
                          padding: "3px 8px",
                          borderRadius: "3px",
                          border: estaAtiva
                            ? "1px solid #00796b"
                            : "1px solid #cfd8dc",
                          backgroundColor: estaAtiva ? "#009688" : "#ffffff",
                          color: estaAtiva ? "#ffffff" : "#455a64",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>Página {numPagina}</span>
                        {qtdCamposNestaPagina > 0 && (
                          <span
                            style={{
                              backgroundColor: estaAtiva
                                ? "rgba(255,255,255,0.3)"
                                : "#eceff1",
                              color: estaAtiva ? "#ffffff" : "#37474f",
                              borderRadius: "10px",
                              padding: "0 4px",
                              fontSize: "0.65rem",
                            }}
                          >
                            {qtdCamposNestaPagina}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                id="caixa-viewport-documento"
                ref={viewportRef}
                onWheel={lidarComRodaMouse}
                style={{
                  width: "100%",
                  height: "560px",
                  backgroundColor: "#cfd8dc",
                  border: "1px solid #90a4ae",
                  borderRadius: "4px",
                  overflow: "auto",
                  position: "relative",
                  boxSizing: "border-box",
                  padding: "16px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                }}
              >
                <div
                  id="canvas-area-demarcacao"
                  ref={containerRef}
                  onMouseDown={iniciarSelecao}
                  onMouseMove={atualizandoSelecao}
                  onMouseUp={finalizarSelecao}
                  style={{
                    position: "relative",
                    width: `${larguraVisualPx}px`,
                    height: `${alturaVisualPx}px`,
                    minWidth: `${larguraVisualPx}px`,
                    minHeight: `${alturaVisualPx}px`,
                    backgroundColor: "#ffffff",
                    border: "1px solid #78909c",
                    borderRadius: "2px",
                    cursor: "crosshair",
                    userSelect: "none",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                    flexShrink: 0,
                  }}
                >
                  {paginasModelo.length >= paginaAtivaCanvas ? (
                    <img
                      src={paginasModelo[paginaAtivaCanvas - 1]}
                      alt={`Gabarito - Página ${paginaAtivaCanvas}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "fill",
                        opacity: opacidadeModelo / 100,
                        pointerEvents: "none",
                      }}
                    ></img>
                  ) : (
                    <div style={{ padding: "16px", color: "#b0bec5" }}>
                      <div
                        style={{
                          borderBottom: "1px dashed #cfd8dc",
                          paddingBottom: "4px",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.8rem",
                        }}
                      >
                        <span>PREFEITURA MUNICIPAL — GUIA ARRECADATÓRIA</span>
                      </div>
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
                          style={{
                            position: "absolute",
                            left: `${campo.xMm * escalaPxPorMm}px`,
                            top: `${campo.yMm * escalaPxPorMm}px`,
                            width: `${campo.larguraMm * escalaPxPorMm}px`,
                            height: `${campo.alturaMm * escalaPxPorMm}px`,
                            border: ativo
                              ? "2px solid #f57c00"
                              : ehDocId
                                ? "2px solid #3f51b5"
                                : ehPagId
                                  ? "2px solid #8e24aa"
                                  : "2px solid #009688",
                            backgroundColor: ativo
                              ? "rgba(245, 124, 0, 0.25)"
                              : ehDocId
                                ? "rgba(63, 81, 181, 0.2)"
                                : ehPagId
                                  ? "rgba(142, 36, 170, 0.2)"
                                  : "rgba(0, 150, 136, 0.2)",
                            color: ativo
                              ? "#e65100"
                              : ehDocId
                                ? "#1a237e"
                                : ehPagId
                                  ? "#4a148c"
                                  : "#004d40",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "2px 4px",
                            pointerEvents: "none",
                            boxSizing: "border-box",
                          }}
                        >
                          {ehDocId
                            ? `🚩 [DOC] ${campo.nomeCampo}`
                            : ehPagId
                              ? `📌 [PÁG] ${campo.nomeCampo}`
                              : campo.nomeCampo}
                        </div>
                      );
                    })}

                  {retanguloAtualMm && paginaCampo === paginaAtivaCanvas && (
                    <div
                      id="retangulo-selecao-ativa"
                      style={{
                        position: "absolute",
                        left: `${retanguloAtualMm.xMm * escalaPxPorMm}px`,
                        top: `${retanguloAtualMm.yMm * escalaPxPorMm}px`,
                        width: `${retanguloAtualMm.larguraMm * escalaPxPorMm}px`,
                        height: `${retanguloAtualMm.alturaMm * escalaPxPorMm}px`,
                        border: "2px dashed #d32f2f",
                        backgroundColor: "rgba(211, 47, 47, 0.2)",
                        pointerEvents: "none",
                        boxSizing: "border-box",
                      }}
                    ></div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                flex: "1 1 320px",
                minWidth: "280px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#e0f2f1",
                    padding: "8px 12px",
                    borderBottom: "1px solid #b2dfdb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong style={{ fontSize: "0.8rem", color: "#00796b" }}>
                    {campoEmEdicaoId ? "Editar Campo" : "Criar Campo"}
                  </strong>
                  {campoEmEdicaoId && (
                    <button
                      onClick={cancelarEdicaoCampo}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#78909c",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        textDecoration: "underline",
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                <div style={{ padding: "12px" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#455a64",
                        marginBottom: "6px",
                        textTransform: "uppercase",
                      }}
                    >
                      Classificação do Campo
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        backgroundColor: "#f5f7f8",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cfd8dc",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight:
                            tipoClassificacao ===
                            TipoClassificacaoCampo.IdentificadorDocumento
                              ? 700
                              : 500,
                          color:
                            tipoClassificacao ===
                            TipoClassificacaoCampo.IdentificadorDocumento
                              ? "#1a237e"
                              : "#37474f",
                        }}
                      >
                        <input
                          type="radio"
                          name="classificacaoCampo"
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
                        <span>Identificador de documento</span>
                      </label>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight:
                            tipoClassificacao ===
                            TipoClassificacaoCampo.IdentificadorPagina
                              ? 700
                              : 500,
                          color:
                            tipoClassificacao ===
                            TipoClassificacaoCampo.IdentificadorPagina
                              ? "#4a148c"
                              : "#37474f",
                        }}
                      >
                        <input
                          type="radio"
                          name="classificacaoCampo"
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
                        <span>Identificador de página</span>
                      </label>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight:
                            tipoClassificacao === TipoClassificacaoCampo.Nenhum
                              ? 700
                              : 500,
                          color:
                            tipoClassificacao === TipoClassificacaoCampo.Nenhum
                              ? "#004d40"
                              : "#37474f",
                        }}
                      >
                        <input
                          type="radio"
                          name="classificacaoCampo"
                          checked={
                            tipoClassificacao === TipoClassificacaoCampo.Nenhum
                          }
                          onChange={() =>
                            mudarClassificacao(TipoClassificacaoCampo.Nenhum)
                          }
                        ></input>
                        <span>Campo comum</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#455a64",
                        marginBottom: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      Nome do Campo
                    </label>
                    <input
                      type="text"
                      value={nomeCampo}
                      onChange={(e) => setNomeCampo(e.target.value)}
                      placeholder={
                        tipoClassificacao ===
                        TipoClassificacaoCampo.IdentificadorPagina
                          ? "Ex: Débitos, Identificação, Resumo"
                          : "Ex: Total, Contribuinte, Inscrição"
                      }
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cfd8dc",
                        height: "32px",
                      }}
                    ></input>
                  </div>

                  {tipoClassificacao ===
                    TipoClassificacaoCampo.IdentificadorDocumento && (
                    <div
                      style={{
                        marginBottom: "10px",
                        backgroundColor: "#e8eaf6",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #c5cae9",
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#1a237e",
                          marginBottom: "4px",
                          textTransform: "uppercase",
                        }}
                      >
                        Texto esperado no documento
                      </label>
                      <input
                        type="text"
                        value={textoEsperadoDocumento}
                        onChange={(e) =>
                          setTextoEsperadoDocumento(e.target.value)
                        }
                        placeholder="Ex: PREFEITURA MUNICIPAL"
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "3px",
                          border: "1px solid #9fa8da",
                          fontSize: "0.75rem",
                          height: "30px",
                        }}
                      ></input>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "#3949ab",
                          marginTop: "2px",
                          display: "block",
                        }}
                      >
                        Texto que identifica onde o carnê começa/termina no PDF.
                      </span>
                    </div>
                  )}

                  {tipoClassificacao ===
                    TipoClassificacaoCampo.IdentificadorPagina && (
                    <div
                      style={{
                        marginBottom: "10px",
                        backgroundColor: "#f3e5f5",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #e1bee7",
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#4a148c",
                          marginBottom: "4px",
                          textTransform: "uppercase",
                        }}
                      >
                        Texto esperado na página
                      </label>
                      <input
                        type="text"
                        value={textoEsperadoPagina}
                        onChange={(e) => setTextoEsperadoPagina(e.target.value)}
                        placeholder="Ex: DEMONSTRATIVO DE DÉBITOS"
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "3px",
                          border: "1px solid #ba68c8",
                          fontSize: "0.75rem",
                          height: "30px",
                        }}
                      ></input>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "#6a1b9a",
                          marginTop: "2px",
                          display: "block",
                        }}
                      >
                        Texto que comprova que a página é deste tipo.
                      </span>
                    </div>
                  )}

                  {tipoClassificacao === TipoClassificacaoCampo.Nenhum && (
                    <>
                      <div style={{ marginBottom: "10px" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#455a64",
                            marginBottom: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          Identificador de página
                        </label>
                        <select
                          value={identificadorPagina}
                          onChange={(e) =>
                            setIdentificadorPagina(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "4px",
                            border: "1px solid #cfd8dc",
                            height: "32px",
                            backgroundColor: "#ffffff",
                            color: "#263238",
                            fontWeight: 600,
                          }}
                        >
                          <option value="">
                            (Selecione o Identificador de página)
                          </option>
                          {identificadoresDePaginaDisponiveis.map((idPag) => (
                            <option key={idPag} value={idPag}>
                              {idPag}
                            </option>
                          ))}
                        </select>
                        {identificadoresDePaginaDisponiveis.length === 0 && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: "#c62828",
                              marginTop: "2px",
                              display: "block",
                            }}
                          >
                            Nenhum identificador de página cadastrado. Cadastre
                            um primeiro marcando a opção acima.
                          </span>
                        )}
                      </div>

                      <div style={{ marginBottom: "10px" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "#455a64",
                            marginBottom: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          Identificador anterior (opcional)
                        </label>
                        <input
                          type="text"
                          value={identificadorAnterior}
                          onChange={(e) =>
                            setIdentificadorAnterior(e.target.value)
                          }
                          placeholder="Ex: TOTAL:, VALOR:"
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "4px",
                            border: "1px solid #cfd8dc",
                            height: "32px",
                          }}
                        ></input>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            color: "#78909c",
                            marginTop: "2px",
                            display: "block",
                          }}
                        >
                          Texto que precede o valor dentro da área.
                        </span>
                      </div>
                    </>
                  )}

                  {retanguloAtualMm && (
                    <div
                      style={{
                        backgroundColor: "#f5f7f8",
                        padding: "6px 8px",
                        borderRadius: "3px",
                        fontSize: "0.7rem",
                        color: "#546e7a",
                        marginBottom: "10px",
                        border: "1px solid #eceff1",
                      }}
                    >
                      <strong>Coordenadas (mm):</strong> Pg: {paginaCampo} | X:{" "}
                      {retanguloAtualMm.xMm.toFixed(1)} | Y:{" "}
                      {retanguloAtualMm.yMm.toFixed(1)} | L:{" "}
                      {retanguloAtualMm.larguraMm.toFixed(1)} | A:{" "}
                      {retanguloAtualMm.alturaMm.toFixed(1)}
                    </div>
                  )}

                  <button
                    onClick={salvarRegiaoCampo}
                    style={{
                      width: "100%",
                      backgroundColor: campoEmEdicaoId ? "#f57c00" : "#009688",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px",
                      borderRadius: "4px",
                      fontWeight: 700,
                      cursor: "pointer",
                      height: "34px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    }}
                  >
                    {campoEmEdicaoId ? "Atualizar Campo" : "Criar Campo"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f7f8",
                    padding: "8px 12px",
                    borderBottom: "1px solid #cfd8dc",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    color: "#455a64",
                  }}
                >
                  CAMPOS DO MODELO ({campos.length})
                </div>
                <div
                  style={{
                    padding: "8px",
                    maxHeight: "250px",
                    overflowY: "auto",
                  }}
                >
                  {campos.length === 0 ? (
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#78909c",
                        margin: "8px",
                      }}
                    >
                      Nenhum campo demarcado.
                    </p>
                  ) : (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {campos.map((c) => {
                        const ehDocId =
                          c.tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorDocumento;
                        const ehPagId =
                          c.tipoClassificacao ===
                          TipoClassificacaoCampo.IdentificadorPagina;

                        return (
                          <li
                            key={c.id}
                            style={{
                              border: "1px solid #eceff1",
                              backgroundColor: "#fafafa",
                              borderRadius: "3px",
                              padding: "6px 8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "0.8rem",
                                  color: ehDocId
                                    ? "#3f51b5"
                                    : ehPagId
                                      ? "#8e24aa"
                                      : "#263238",
                                }}
                              >
                                {ehDocId
                                  ? `🚩 [DOC] ${c.nomeCampo}`
                                  : ehPagId
                                    ? `📌 [PÁG] ${c.nomeCampo}`
                                    : c.nomeCampo}
                              </strong>
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "#78909c",
                                }}
                              >
                                {ehDocId &&
                                  `Identificador de Documento • "${c.textoEsperadoDocumento}"`}
                                {ehPagId &&
                                  `Identificador de Página • "${c.textoEsperadoPagina}"`}
                                {!ehDocId &&
                                  !ehPagId &&
                                  `Estrutura: ${c.identificadorPagina || "Sem vínculo"} • Pg ref: ${c.pagina} • ${c.larguraMm}x${c.alturaMm}mm`}
                                {c.identificadorAnterior &&
                                  ` • [Pré: "${c.identificadorAnterior}"]`}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                onClick={() => iniciarEdicaoCampo(c)}
                                title="Editar"
                                style={{
                                  border: "1px solid #cfd8dc",
                                  background: "#ffffff",
                                  color: "#00796b",
                                  padding: "3px 6px",
                                  borderRadius: "3px",
                                  cursor: "pointer",
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                }}
                              >
                                ✎
                              </button>
                              <button
                                onClick={() =>
                                  removerRegiaoCampo(c.id, c.nomeCampo)
                                }
                                title="Remover"
                                style={{
                                  border: "1px solid #ffcdd2",
                                  background: "#ffebee",
                                  color: "#c62828",
                                  padding: "3px 6px",
                                  borderRadius: "3px",
                                  cursor: "pointer",
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. REGRAS DE VALIDAÇÃO */}
      <div
        id="accordion-validacoes"
        style={{
          marginBottom: "12px",
          backgroundColor: "#ffffff",
          border: "1px solid #cfd8dc",
          borderRadius: "4px",
          overflow: "hidden",
          opacity:
            semLayoutSelecionado ||
            (emModoEdicao && etapaAberta !== "validacoes")
              ? 0.65
              : 1,
        }}
      >
        <div
          onClick={() => {
            if (!semLayoutSelecionado && !emModoEdicao)
              alternarEtapa("validacoes");
          }}
          style={{
            backgroundColor:
              etapaAberta === "validacoes" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor:
              !semLayoutSelecionado && !emModoEdicao
                ? "pointer"
                : "not-allowed",
            borderBottom:
              etapaAberta === "validacoes" ? "1px solid #b2dfdb" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                color: etapaAberta === "validacoes" ? "#00796b" : "#546e7a",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              {etapaAberta === "validacoes" ? "▼" : "▶"}
            </span>
            <strong
              style={{
                fontSize: "0.9rem",
                color: etapaAberta === "validacoes" ? "#00796b" : "#263238",
              }}
            >
              3. Regras de validação
            </strong>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#546e7a" }}>
            {queries.length} validações ativas
          </span>
        </div>
        <div
          className={`accordion-content-wrapper ${etapaAberta === "validacoes" && !semLayoutSelecionado ? "accordion-content-open" : "accordion-content-closed"}`}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: "2 1 500px",
                backgroundColor: "#ffffff",
                border: "1px solid #cfd8dc",
                borderRadius: "4px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#e0f2f1",
                  margin: "-14px -14px 14px -14px",
                  padding: "8px 14px",
                  borderBottom: "1px solid #b2dfdb",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  color: "#00796b",
                }}
              >
                {queryEmEdicaoId ? "EDITAR QUERY" : "NOVA VALIDAÇÃO"}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#455a64",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Nome
                </label>
                <input
                  type="text"
                  value={nomeQuery}
                  onChange={(e) => setNomeQuery(e.target.value)}
                  placeholder="Ex: Nome do contribuinte"
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "1px solid #cfd8dc",
                    height: "32px",
                  }}
                ></input>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#455a64",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  Regra para validar
                </label>
                <SqlCodeEditor
                  value={sqlQuery}
                  onChange={(novoSql) => {
                    setSqlQuery(novoSql);
                    setSqlAnalisado(false);
                  }}
                  camposDisponiveis={campos.map((c) => c.nomeCampo)}
                ></SqlCodeEditor>
              </div>
              <div
                id="container-botao-analisar"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={analisarQuerySQL}
                  style={{
                    backgroundColor: "#37474f",
                    color: "#ffffff",
                    border: "none",
                    padding: "6px 14px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>Analisar</span>
                </button>
              </div>
              {sqlAnalisado && (
                <div
                  style={{
                    backgroundColor: "#f5f7f8",
                    border: "1px solid #cfd8dc",
                    padding: "12px",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "12px",
                      display: "flex",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize: "0.75rem",
                          color: "#00796b",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Parâmetros de Entrada ($):
                      </strong>
                      {parametrosEncontrados.length > 0 ? (
                        parametrosEncontrados.map((p) => (
                          <span
                            key={p}
                            style={{
                              display: "inline-block",
                              backgroundColor: "#e0f2f1",
                              color: "#00796b",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              marginRight: "4px",
                              border: "1px solid #b2dfdb",
                            }}
                          >
                            {p.includes(" ") ? `\${${p}}` : `$${p}`}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#78909c" }}>
                          Nenhum
                        </span>
                      )}
                    </div>
                    <div>
                      <strong
                        style={{
                          fontSize: "0.75rem",
                          color: "#00796b",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Retornos Apurados (AS):
                      </strong>
                      {camposRetornados.length > 0 ? (
                        camposRetornados.map((c) => (
                          <span
                            key={c}
                            style={{
                              display: "inline-block",
                              backgroundColor: "#e8eaf6",
                              color: "#283593",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              marginRight: "4px",
                              border: "1px solid #c5cae9",
                            }}
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#78909c" }}>
                          Nenhum
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-end",
                      marginBottom: "12px",
                      backgroundColor: "#ffffff",
                      padding: "8px",
                      borderRadius: "3px",
                      border: "1px solid #cfd8dc",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#455a64",
                        }}
                      >
                        Campo Retornado (Banco)
                      </label>
                      <select
                        value={regraCampoRetornado}
                        onChange={(e) => setRegraCampoRetornado(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          borderRadius: "3px",
                          border: "1px solid #cfd8dc",
                          height: "28px",
                        }}
                      >
                        {camposRetornados.map((cr) => (
                          <option key={cr} value={cr}>
                            {cr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: "70px" }}>
                      <label
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#455a64",
                        }}
                      >
                        Operador
                      </label>
                      <select
                        value={regraOperador}
                        onChange={(e) => setRegraOperador(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          borderRadius: "3px",
                          border: "1px solid #cfd8dc",
                          height: "28px",
                        }}
                      >
                        <option value="=">=</option>
                        <option value="<>">&lt;&gt;</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#455a64",
                        }}
                      >
                        Campo no Documento
                      </label>
                      <select
                        value={regraCampoCarne}
                        onChange={(e) => setRegraCampoCarne(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          borderRadius: "3px",
                          border: "1px solid #cfd8dc",
                          height: "28px",
                        }}
                      >
                        {camposNormaisDisponiveis.map((c) => (
                          <option key={c.id} value={c.nomeCampo}>
                            {c.nomeCampo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={adicionarRegraValidacao}
                      style={{
                        padding: "0 12px",
                        backgroundColor: "#009688",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "3px",
                        fontWeight: 700,
                        cursor: "pointer",
                        height: "28px",
                      }}
                    >
                      + Vincular
                    </button>
                  </div>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.8rem",
                      marginBottom: "12px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#009688",
                          color: "#ffffff",
                          textAlign: "left",
                        }}
                      >
                        <th style={{ padding: "6px 8px" }}>
                          Campo Banco de Dados
                        </th>
                        <th style={{ padding: "6px 8px", textAlign: "center" }}>
                          Operador
                        </th>
                        <th style={{ padding: "6px 8px" }}>Campo Documento</th>
                        <th style={{ padding: "6px 8px", textAlign: "center" }}>
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {regrasAtuais.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              color: "#78909c",
                              backgroundColor: "#ffffff",
                              borderBottom: "1px solid #cfd8dc",
                            }}
                          >
                            Nenhuma regra configurada
                          </td>
                        </tr>
                      )}
                      {regrasAtuais.map((r) => (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: "1px solid #eceff1",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <td
                            style={{
                              padding: "6px 8px",
                              fontWeight: 700,
                              color: "#283593",
                            }}
                          >
                            {r.campoRetornado}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            {r.operador}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              fontWeight: 700,
                              color: "#00796b",
                            }}
                          >
                            {r.campoCarne}
                          </td>
                          <td
                            style={{ padding: "6px 8px", textAlign: "center" }}
                          >
                            <button
                              onClick={() => removerRegraValidacao(r.id)}
                              style={{
                                border: "none",
                                background: "none",
                                color: "#c62828",
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "6px",
                    }}
                  >
                    {queryEmEdicaoId && (
                      <button
                        onClick={cancelarEdicaoQuery}
                        style={{
                          backgroundColor: "transparent",
                          color: "#546e7a",
                          border: "none",
                          padding: "6px 12px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      onClick={salvarQueryCompleta}
                      style={{
                        backgroundColor: "#009688",
                        color: "#ffffff",
                        border: "none",
                        padding: "6px 14px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Salvar Validação
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: "1 1 280px", minWidth: "260px" }}>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f7f8",
                    padding: "8px 12px",
                    borderBottom: "1px solid #cfd8dc",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    color: "#455a64",
                  }}
                >
                  VALIDAÇÕES CONFIGURADAS ({queries.length})
                </div>
                <div
                  style={{
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {queries.length === 0 && (
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#78909c",
                        margin: "4px",
                      }}
                    >
                      Nenhuma query configurada.
                    </p>
                  )}
                  {queries.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        border: "1px solid #cfd8dc",
                        borderRadius: "3px",
                        padding: "10px",
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "0.85rem",
                          color: "#00796b",
                        }}
                      >
                        {q.nome}
                      </h4>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#546e7a",
                          marginBottom: "8px",
                        }}
                      >
                        {q.regras.length} regras vinculadas
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => editarQuery(q)}
                          style={{
                            flex: 1,
                            padding: "4px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #cfd8dc",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "#37474f",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removerQuery(q.id, q.nome)}
                          style={{
                            flex: 1,
                            padding: "4px",
                            backgroundColor: "#ffebee",
                            color: "#c62828",
                            border: "1px solid #ffcdd2",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="rodape-salvar-tudo"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "20px",
          paddingTop: "16px",
          borderTop: "2px solid #cfd8dc",
        }}
      >
        <button
          type="button"
          onClick={salvarTudo}
          disabled={semLayoutSelecionado || emModoEdicao || !houveAlteracao}
          title={
            semLayoutSelecionado
              ? "Selecione ou crie um layout antes de salvar"
              : emModoEdicao
                ? "Finalize as edições pendentes antes de salvar tudo"
                : !houveAlteracao
                  ? "Nenhuma alteração foi realizada para salvar"
                  : "Salvar todas as alterações"
          }
          style={{
            backgroundColor:
              semLayoutSelecionado || emModoEdicao || !houveAlteracao
                ? "#b0bec5"
                : "#00796b",
            color: "#ffffff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor:
              semLayoutSelecionado || emModoEdicao || !houveAlteracao
                ? "not-allowed"
                : "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Salvar</span>
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

export default ParametrizacaoPage;
