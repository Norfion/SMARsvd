import {
  ModalInformativo,
  type TipoModalInformativo,
} from "../components/ModalInformativo";
import { useState, useRef } from "react";
import { SqlCodeEditor } from "../components/SqlCodeEditor";
import { processarArquivoPdfModelo } from "../utils/pdfModelReader";
import type {
  OrientacaoPagina,
  FormatoPapel,
  RegiaoCampo,
  LayoutCliente,
  QueryValidacao,
  RegraValidacao,
  TipoProvedorBanco,
} from "../types/layout";

interface ParametrizacaoPageProps {
  layoutsSalvos: LayoutCliente[];
  onSalvarLayouts: (layouts: LayoutCliente[]) => void;
  onExcluirLayout?: (idOuNome: string) => void;
}

export function ParametrizacaoPage({
  layoutsSalvos,
  onSalvarLayouts,
  onExcluirLayout,
}: ParametrizacaoPageProps) {
  const CLIENTES_DISPONIVEIS = [
    "PM Sertãozinho - SP",
    "PM Serra - ES",
    "PM Birigui - SP",
    "PM Araraquara - SP",
    "Outro",
  ];

  // ==========================================
  // ESTADOS DO FLUXO GERAL E ACCORDIONS
  // ==========================================
  // Identificador do modelo no select e o ID (GUID) real do banco
  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [layoutId, setLayoutId] = useState<string | undefined>(undefined);
  const [etapaAberta, setEtapaAberta] = useState<
    "layout" | "campos" | "validacoes" | "conexao" | null
  >(null);

  // Estados de conexão com o banco de dados
  const [dbProvedor, setDbProvedor] = useState<TipoProvedorBanco>("SQL Server");
  const [dbServidor, setDbServidor] = useState<string>("");
  const [dbPorta, setDbPorta] = useState<string>("1433");
  const [dbUsuario, setDbUsuario] = useState<string>("");
  const [dbSenha, setDbSenha] = useState<string>("");

  // Estados de Criação de Layout (Menu de Opções)
  const [modalNovoLayoutAberto, setModalNovoLayoutAberto] = useState(false);
  const [carregandoPdfModelo, setCarregandoPdfModelo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Alterna o acordeão somente se houver layout selecionado
  const alternarEtapa = (
    etapa: "layout" | "campos" | "validacoes" | "conexao",
  ) => {
    if (!layoutSelecionadoId) return;
    setEtapaAberta((etapaAtual) => (etapaAtual === etapa ? null : etapa));
  };

  // ==========================================
  // ESTADOS: ETAPA 1 - LAYOUT
  // ==========================================
  const [cliente, setCliente] = useState<string>("PM Sertãozinho - SP");
  const [nomeModelo, setNomeModelo] = useState<string>("");
  const [orientacao, setOrientacao] = useState<OrientacaoPagina>("Paisagem");
  const [formatoPapel, setFormatoPapel] = useState<FormatoPapel>("A4");
  const [larguraMm, setLarguraMm] = useState<number>(70);
  const [alturaMm, setAlturaMm] = useState<number>(30);
  const [quantidadePaginasPadrao, setQuantidadePaginasPadrao] =
    useState<number>(1);

  // Armazena as imagens renderizadas das páginas do PDF de gabarito
  const [paginasModelo, setPaginasModelo] = useState<string[]>([]);
  const [nomeArquivoModelo, setNomeArquivoModelo] = useState<string>("");

  // ==========================================
  // ESTADOS: ETAPA 2 - CAMPOS & VISUALIZAÇÃO
  // ==========================================
  const [opacidadeModelo, setOpacidadeModelo] = useState<number>(45);
  const [zoomNivel, setZoomNivel] = useState<number>(100);

  const LARGURA_CONTAINER_BASE_PX = 800;
  const escalaPxPorMmBase = LARGURA_CONTAINER_BASE_PX / (larguraMm || 1);
  const escalaPxPorMm = escalaPxPorMmBase * (zoomNivel / 100);

  const larguraVisualPx = Math.round(larguraMm * escalaPxPorMm);
  const alturaVisualPx = Math.round(alturaMm * escalaPxPorMm);

  const [campos, setCampos] = useState<RegiaoCampo[]>([]);

  const [campoEmEdicaoId, setCampoEmEdicaoId] = useState<string | null>(null);
  const [nomeCampo, setNomeCampo] = useState("");
  const [paginaCampo, setPaginaCampo] = useState<number>(1);
  const [paginaAtivaCanvas, setPaginaAtivaCanvas] = useState<number>(1);
  const [ehIdentificador, setEhIdentificador] = useState(false);
  const [textoEsperado, setTextoEsperado] = useState("");

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

  // ==========================================
  // ESTADOS: ETAPA 3 - VALIDAÇÕES (SQL)
  // ==========================================
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

  // Flag unificada: indica se alguma edição pontual está em andamento
  const emModoEdicao = campoEmEdicaoId !== null || queryEmEdicaoId !== null;

  // Layout não selecionado trava todos os acordeões
  const semLayoutSelecionado = !layoutSelecionadoId;

  // ==========================================
  // GESTÃO DE LAYOUT E IMPORTAÇÃO DE MODELO
  // ==========================================
  const iniciarCriacaoManual = () => {
    const nomePadrao = "Novo Layout";
    setModalNovoLayoutAberto(false);
    setLayoutId(undefined); // <-- Garante que é um novo layout
    setLayoutSelecionadoId(nomePadrao);
    setCliente("PM Sertãozinho - SP");
    setNomeModelo(nomePadrao);
    setOrientacao("Paisagem");
    setFormatoPapel("A4");
    setLarguraMm(70);
    setAlturaMm(30);
    setQuantidadePaginasPadrao(1);
    setCampos([]);
    setQueries([]);
    setPaginasModelo([]);
    setNomeArquivoModelo("");
    setDbProvedor("SQL Server");
    setDbServidor("");
    setDbPorta("1433");
    setDbUsuario("");
    setDbSenha("");

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

      setLayoutId(undefined); // <-- Garante que é um novo layout importado
      setLayoutSelecionadoId(nomeIdentificador);
      setCliente("PM Sertãozinho - SP");
      setNomeModelo(nomeIdentificador);
      setOrientacao(dados.orientacao);
      setFormatoPapel(dados.formatoPapel);
      setLarguraMm(dados.larguraMm);
      setAlturaMm(dados.alturaMm);
      setQuantidadePaginasPadrao(dados.quantidadePaginas);
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
        `PDF "${dados.nomeArquivo}" carregado com sucesso!\n• Páginas: ${dados.quantidadePaginas}\n• Dimensões: ${dados.larguraMm} x ${dados.alturaMm} mm (${dados.formatoPapel})`,
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
    // 1. Aciona a exclusão persistente no banco de dados através da rota DELETE da API
    if (onExcluirLayout) {
      onExcluirLayout(layoutId || layoutSelecionadoId);
    }

    // 2. Atualiza o estado em memória localmente
    const novaLista = layoutsSalvos.filter(
      (l) => l.nomeModelo !== layoutSelecionadoId,
    );
    onSalvarLayouts(novaLista);

    exibirMensagem(
      "sucesso",
      "Layout Removido",
      `O layout "${layoutSelecionadoId}" foi removido com sucesso!`,
    );

    // 3. Limpa o formulário e os campos da tela
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
    if (!nomeLayout) {
      setLayoutId(undefined);
      setLayoutSelecionadoId("");
      setEtapaAberta(null);
      return;
    }

    const layout = layoutsSalvos.find((l) => l.nomeModelo === nomeLayout);
    if (!layout) return;

    setLayoutId(layout.id); // <-- Armazena o ID do layout existente
    setLayoutSelecionadoId(layout.nomeModelo);
    setCliente(layout.cliente);
    setNomeModelo(layout.nomeModelo);
    setOrientacao(layout.orientacao);
    setFormatoPapel(layout.formatoPapel);
    setLarguraMm(layout.larguraPaginaMm);
    setAlturaMm(layout.alturaPaginaMm);
    setQuantidadePaginasPadrao(layout.quantidadePaginasPadrao || 1);
    setCampos(layout.campos || []);
    setQueries(layout.queriesValidacao || []);
    setPaginasModelo(layout.paginasModeloBase64 || []);
    setNomeArquivoModelo(layout.nomeArquivoModelo || "");

    setDbProvedor(layout.conexaoBanco?.provedor || "SQL Server");
    setDbServidor(layout.conexaoBanco?.servidor || "");
    setDbPorta(
      layout.conexaoBanco?.porta ? String(layout.conexaoBanco.porta) : "1433",
    );
    setDbUsuario(layout.conexaoBanco?.usuario || "");
    setDbSenha(layout.conexaoBanco?.senha || "");

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
      id: layoutId, // <-- Envia o ID para o backend reconhecer a atualização
      cliente,
      nomeModelo: nomeNormalizado,
      versao: 1,
      orientacao,
      formatoPapel,
      larguraPaginaMm: larguraMm,
      alturaPaginaMm: alturaMm,
      quantidadePaginasPadrao,
      campos,
      queriesValidacao: queries,
      paginasModeloBase64: paginasModelo,
      nomeArquivoModelo,
      conexaoBanco: {
        provedor: dbProvedor,
        servidor: dbServidor.trim(),
        porta: dbPorta ? Number(dbPorta) : 1433,
        usuario: dbUsuario.trim(),
        senha: dbSenha,
      },
    };

    // Verifica se já existe um layout salvo com o ID selecionado
    const layoutJaExiste = layoutsSalvos.some(
      (l) => l.nomeModelo === layoutSelecionadoId,
    );

    if (layoutJaExiste) {
      // Atualiza o registro existente
      onSalvarLayouts(
        layoutsSalvos.map((l) =>
          l.nomeModelo === layoutSelecionadoId ? layoutFinal : l,
        ),
      );
    } else {
      // Se o usuário renomeou para um nome que já existe na lista, evita duplicatas
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
        // Novo registro: adiciona ao array de layouts
        onSalvarLayouts([...layoutsSalvos, layoutFinal]);
      }
    }

    setLayoutSelecionadoId(layoutFinal.nomeModelo);
    exibirMensagem(
      "sucesso",
      "Layout Salvo",
      "Todas as configurações do layout foram salvas com sucesso!",
    );
  };

  // ==========================================
  // FUNÇÕES DA ETAPA 2 (CAMPOS CARTESIANOS)
  // ==========================================
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
    setCampoEmEdicaoId(campo.id);
    setNomeCampo(campo.nomeCampo);
    setPaginaCampo(paginaDoCampo);
    setPaginaAtivaCanvas(paginaDoCampo);
    setEhIdentificador(!!campo.ehIdentificadorPrimeiraPagina);
    setTextoEsperado(campo.textoEsperadoIdentificador || "");
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
    setEhIdentificador(false);
    setTextoEsperado("");
    setRetanguloAtualMm(null);
  };

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

    const payloadCampo: RegiaoCampo = {
      id: campoEmEdicaoId || crypto.randomUUID(),
      nomeCampo: nomeCampo.trim(),
      pagina: Number(paginaCampo),
      xMm: retanguloAtualMm.xMm,
      yMm: retanguloAtualMm.yMm,
      larguraMm: retanguloAtualMm.larguraMm,
      alturaMm: retanguloAtualMm.alturaMm,
      ehIdentificadorPrimeiraPagina: ehIdentificador,
      textoEsperadoIdentificador: ehIdentificador
        ? textoEsperado.trim()
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

  // ==========================================
  // FUNÇÕES DA ETAPA 3 (VALIDAÇÕES SQL)
  // ==========================================
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

  const analisarQuerySQL = () => {
    const texto = sqlQuery.trim();
    if (!texto) {
      exibirMensagem("aviso", "SQL vazio", "Informe a instrução SQL.");
      return;
    }

    const comandosBloqueados =
      /\b(UPDATE|DELETE|INSERT|EXEC|EXECUTE|DROP|ALTER|CREATE|TRUNCATE|MERGE)\b/i;
    if (comandosBloqueados.test(texto)) {
      exibirMensagem(
        "aviso",
        "Bloqueio de Segurança",
        "São permitidas apenas consultas somente leitura (SELECT).",
      );
      return;
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
      exibirMensagem(
        "aviso",
        "Parâmetros inválidos",
        `Os seguintes parâmetros não existem nos campos do layout: ${parametrosInvalidos.join(
          ", ",
        )}`,
      );
      return;
    }

    const regexRetorno = /\bAS\s+([a-zA-Z0-9_]+)/gi;
    const rets: string[] = [];
    while ((match = regexRetorno.exec(texto)) !== null) {
      rets.push(match[1]);
    }
    const retsUnicos = [...new Set(rets)];

    if (retsUnicos.length === 0) {
      exibirMensagem(
        "aviso",
        "Campo inválido",
        "Não foi possível identificar os campos de retorno. Utilize 'AS NomeVariavel' na query para especificar as colunas.",
      );
      return;
    }

    setParametrosEncontrados(paramsUnicos);
    setCamposRetornados(retsUnicos);
    setSqlAnalisado(true);
    if (retsUnicos.length > 0) setRegraCampoRetornado(retsUnicos[0]);
    if (campos.length > 0) setRegraCampoCarne(campos[0].nomeCampo);
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
    const params = query.parametrosEncontrados ?? [];
    const retornos = query.camposRetornados ?? [];

    setQueryEmEdicaoId(query.id);
    setNomeQuery(query.nome);
    setSqlQuery(query.sql);
    setParametrosEncontrados(params);
    setCamposRetornados(retornos);
    setRegrasAtuais(query.regras);
    setSqlAnalisado(true);

    if (retornos.length > 0) {
      setRegraCampoRetornado(retornos[0]);
    }
    if (campos.length > 0) {
      setRegraCampoCarne(campos[0].nomeCampo);
    }
  };

  return (
    <div id="container-parametrizacao">
      <style>
        {`
          .accordion-content-wrapper {
            transition: max-height 0.35s ease, opacity 0.25s ease, padding 0.35s ease;
            overflow: hidden;
          }
          .accordion-content-open {
            max-height: 2000px;
            opacity: 1;
            padding: 16px;
          }
          .accordion-content-closed {
            max-height: 0;
            opacity: 0;
            padding: 0 16px;
          }

          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }

          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={lidarComArquivoModelo}
        style={{ display: "none" }}
      ></input>

      {/* BANNER / CONTEXTO DE SELEÇÃO GLOBAL DE LAYOUT */}
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
          <span
            style={{
              backgroundColor: "#e0f2f1",
              color: "#00796b",
              padding: "4px 8px",
              borderRadius: "3px",
              fontWeight: 700,
              fontSize: "0.75rem",
              border: "1px solid #b2dfdb",
            }}
          >
            LAYOUT
          </span>

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

        {/* Botão Remover Layout */}
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

        {/* Menu "+ Novo Layout" */}
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
                Criar Manualmente
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
                Importar Modelo (PDF)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* SEÇÃO 1: CONFIGURAÇÃO DO LAYOUT            */}
      {/* ========================================== */}
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
          className={`accordion-content-wrapper ${
            etapaAberta === "layout" && !semLayoutSelecionado && !emModoEdicao
              ? "accordion-content-open"
              : "accordion-content-closed"
          }`}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
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
                Orientação
              </label>
              <select
                value={orientacao}
                onChange={(e) =>
                  setOrientacao(e.target.value as OrientacaoPagina)
                }
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                }}
              >
                <option value="Paisagem">Paisagem</option>
                <option value="Retrato">Retrato</option>
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
                Formato
              </label>
              <select
                value={formatoPapel}
                onChange={(e) =>
                  setFormatoPapel(e.target.value as FormatoPapel)
                }
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                }}
              >
                <option value="A4">A4</option>
                <option value="Carta">Carta</option>
                <option value="Personalizado">Personalizado</option>
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
                Páginas do Documento
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={quantidadePaginasPadrao}
                onChange={(e) =>
                  setQuantidadePaginasPadrao(Number(e.target.value))
                }
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

      {/* ========================================== */}
      {/* SEÇÃO 2: MAPEAMENTO DE CAMPOS              */}
      {/* ========================================== */}
      <div
        id="accordion-campos"
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
          className={`accordion-content-wrapper ${
            etapaAberta === "campos" && !semLayoutSelecionado && !emModoEdicao
              ? "accordion-content-open"
              : "accordion-content-closed"
          }`}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* CANVAS CARTESIANO COM BARRA DE FERRAMENTAS */}
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
                  {orientacao} • {larguraMm} x {alturaMm} (mm)
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
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
                        quantidadePaginasPadrao || 1,
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

              {/* VIEWPORT COM SCROLL */}
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
                      const ehAnchor = campo.ehIdentificadorPrimeiraPagina;

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
                              : ehAnchor
                                ? "2px solid #7b1fa2"
                                : "2px solid #009688",
                            backgroundColor: ativo
                              ? "rgba(245, 124, 0, 0.25)"
                              : ehAnchor
                                ? "rgba(123, 31, 162, 0.2)"
                                : "rgba(0, 150, 136, 0.2)",
                            color: ativo
                              ? "#e65100"
                              : ehAnchor
                                ? "#4a148c"
                                : "#004d40",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "2px 4px",
                            pointerEvents: "none",
                            boxSizing: "border-box",
                          }}
                        >
                          {ehAnchor ? `🚩 ${campo.nomeCampo}` : campo.nomeCampo}
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

            {/* PAINEL LATERAL DE CADASTRO DO CAMPO */}
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
                      placeholder="Ex: Contribuinte, Inscricao, Valor"
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cfd8dc",
                        height: "32px",
                      }}
                    ></input>
                  </div>

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

                  <div
                    style={{
                      backgroundColor: ehIdentificador ? "#f3e5f5" : "#f5f7f8",
                      padding: "8px 10px",
                      borderRadius: "4px",
                      border: ehIdentificador
                        ? "1px solid #ce93d8"
                        : "1px solid #eceff1",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: ehIdentificador ? "#6a1b9a" : "#455a64",
                        }}
                      >
                        Identificador de página
                      </span>
                      <button
                        type="button"
                        onClick={() => setEhIdentificador(!ehIdentificador)}
                        style={{
                          position: "relative",
                          width: "40px",
                          height: "22px",
                          borderRadius: "11px",
                          backgroundColor: ehIdentificador
                            ? "#7b1fa2"
                            : "#b0bec5",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            transform: ehIdentificador
                              ? "translateX(18px)"
                              : "translateX(0px)",
                            transition: "transform 0.2s",
                          }}
                        ></span>
                      </button>
                    </div>

                    {ehIdentificador && (
                      <div
                        style={{
                          marginTop: "8px",
                          paddingTop: "8px",
                          borderTop: "1px dashed #e1bee7",
                        }}
                      >
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "#6a1b9a",
                            marginBottom: "3px",
                          }}
                        >
                          Texto exato esperado nesta área:
                        </label>
                        <input
                          type="text"
                          value={textoEsperado}
                          onChange={(e) => setTextoEsperado(e.target.value)}
                          placeholder="Ex: PARA USO DOS CORREIOS"
                          style={{
                            width: "100%",
                            padding: "5px 8px",
                            borderRadius: "3px",
                            border: "1px solid #ba68c8",
                            fontSize: "0.75rem",
                            height: "28px",
                          }}
                        ></input>
                      </div>
                    )}
                  </div>

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

              {/* LISTAGEM DE CAMPOS CADASTRADOS */}
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
                      {campos.map((c) => (
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
                                color: c.ehIdentificadorPrimeiraPagina
                                  ? "#6a1b9a"
                                  : "#263238",
                              }}
                            >
                              {c.ehIdentificadorPrimeiraPagina
                                ? `🚩 ${c.nomeCampo}`
                                : c.nomeCampo}
                            </strong>
                            <span
                              style={{
                                fontSize: "0.65rem",
                                color: "#78909c",
                              }}
                            >
                              Pg: {c.pagina} • {c.larguraMm}x{c.alturaMm}mm
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
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SEÇÃO 3: VALIDAÇÕES (SQL SERVER)           */}
      {/* ========================================== */}
      <div
        id="accordion-validacoes"
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
          className={`accordion-content-wrapper ${
            etapaAberta === "validacoes" &&
            !semLayoutSelecionado &&
            !emModoEdicao
              ? "accordion-content-open"
              : "accordion-content-closed"
          }`}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* PAINEL DE CRIAÇÃO DA QUERY */}
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

              {/* Contêiner flexível para alinhar o botão Analisar à direita */}
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
                            {p}
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
                        {campos.map((c) => (
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
                        <th
                          style={{
                            padding: "6px 8px",
                            textAlign: "center",
                          }}
                        >
                          Operador
                        </th>
                        <th style={{ padding: "6px 8px" }}>Campo Documento</th>
                        <th
                          style={{
                            padding: "6px 8px",
                            textAlign: "center",
                          }}
                        >
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
                            style={{
                              padding: "6px 8px",
                              textAlign: "center",
                            }}
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

            {/* LISTA DE CONSULTAS CADASTRADAS */}
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

      {/* ========================================== */}
      {/* SEÇÃO 4: CONEXÃO COM BANCO DE DADOS        */}
      {/* ========================================== */}
      <div
        id="accordion-conexao-banco"
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
            if (!semLayoutSelecionado && !emModoEdicao) {
              alternarEtapa("conexao");
            }
          }}
          style={{
            backgroundColor: etapaAberta === "conexao" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor:
              !semLayoutSelecionado && !emModoEdicao
                ? "pointer"
                : "not-allowed",
            borderBottom:
              etapaAberta === "conexao" ? "1px solid #b2dfdb" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                color: etapaAberta === "conexao" ? "#00796b" : "#546e7a",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              {etapaAberta === "conexao" ? "▼" : "▶"}
            </span>
            <strong
              style={{
                fontSize: "0.9rem",
                color: etapaAberta === "conexao" ? "#00796b" : "#263238",
              }}
            >
              4. Conexão com banco de dados
            </strong>
          </div>

          <span style={{ fontSize: "0.75rem", color: "#546e7a" }}>
            {semLayoutSelecionado
              ? "(Layout não selecionado)"
              : emModoEdicao
                ? "(Bloqueado durante edição)"
                : dbServidor
                  ? `${dbProvedor}: ${dbServidor}`
                  : "Não configurado"}
          </span>
        </div>

        <div
          className={`accordion-content-wrapper ${
            etapaAberta === "conexao" && !semLayoutSelecionado && !emModoEdicao
              ? "accordion-content-open"
              : "accordion-content-closed"
          }`}
        >
          {/* AVISO DE SEGURANÇA: USUÁRIO SOMENTE LEITURA */}
          <div
            id="alerta-seguranca-banco"
            style={{
              backgroundColor: "#fff8e1",
              border: "1px solid #ffe082",
              borderRadius: "4px",
              padding: "12px 14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>⚠️</span>
            <div
              style={{ fontSize: "0.8rem", color: "#6d4c41", lineHeight: 1.4 }}
            >
              <strong>Atenção às permissões de acesso:</strong>
              <p style={{ margin: "4px 0 0 0" }}>
                Por motivos de segurança e integridade das informações
                corporativas, utilize exclusivamente credenciais de um usuário
                com{" "}
                <strong>permissão restrita de leitura (db_datareader)</strong>{" "}
                no banco de dados.
              </p>
              <p style={{ margin: "4px 0 0 0" }}>
                Caso não possua um usuário apenas com permissão de leitura,
                solicite ao DBA ou crie um usuário dedicado com acesso restrito
                antes de prosseguir.
              </p>
            </div>
          </div>

          {/* BANCO DE DADOS */}
          <div style={{ marginBottom: "14px" }}>
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
              Banco de dados
            </label>
            <select
              value={dbProvedor}
              onChange={(e) =>
                setDbProvedor(e.target.value as TipoProvedorBanco)
              }
              style={{
                width: "100%",
                maxWidth: "280px",
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #cfd8dc",
                height: "34px",
                backgroundColor: "#ffffff",
                color: "#263238",
                fontWeight: 600,
              }}
            >
              <option value="SQL Server">SQL Server</option>
            </select>
          </div>

          {/* CAMPOS DO FORMULÁRIO DE CONEXÃO */}
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
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Servidor
              </label>
              <input
                type="text"
                value={dbServidor}
                onChange={(e) => setDbServidor(e.target.value)}
                placeholder="Ex: PMTesteSQL2 ou 172.168.0.00"
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
                Porta
              </label>
              <input
                type="number"
                value={dbPorta}
                onChange={(e) => setDbPorta(e.target.value)}
                placeholder="1433"
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
                Usuário
              </label>
              <input
                type="text"
                value={dbUsuario}
                onChange={(e) => setDbUsuario(e.target.value)}
                placeholder="Ex: smartbValidacao"
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
                Senha
              </label>
              <input
                type="password"
                value={dbSenha}
                onChange={(e) => setDbSenha(e.target.value)}
                placeholder="••••••••"
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

      {/* ========================================== */}
      {/* BOTÃO GLOBAL "SALVAR TUDO"                */}
      {/* ========================================== */}
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
          disabled={semLayoutSelecionado || emModoEdicao}
          title={
            semLayoutSelecionado
              ? "Selecione ou crie um layout antes de salvar"
              : emModoEdicao
                ? "Finalize as edições pendentes antes de salvar tudo"
                : "Salvar todas as seções simultaneamente"
          }
          style={{
            backgroundColor:
              semLayoutSelecionado || emModoEdicao ? "#b0bec5" : "#00796b",
            color: "#ffffff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor:
              semLayoutSelecionado || emModoEdicao ? "not-allowed" : "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Salvar</span>
        </button>
      </div>
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
