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
} from "../types/layout";

interface ParametrizacaoPageProps {
  layoutsSalvos: LayoutCliente[];
  onSalvarLayouts: (layouts: LayoutCliente[]) => void;
}

export function ParametrizacaoPage({
  layoutsSalvos,
  onSalvarLayouts,
}: ParametrizacaoPageProps) {
  const CLIENTES_DISPONIVEIS = [
    "PM Sertãozinho - SP",
    "PM Serra - ES",
    "PM Birigui - SP",
    "PM Araraquara - SP",
    "Outro / Geral",
  ];

  // ==========================================
  // ESTADOS DO FLUXO GERAL E ACCORDIONS
  // ==========================================
  const [layoutSelecionadoId, setLayoutSelecionadoId] = useState<string>("");
  const [etapaAberta, setEtapaAberta] = useState<
    "layout" | "campos" | "validacoes" | null
  >("layout");

  const [layoutConcluido, setLayoutConcluido] = useState<boolean>(false);
  const [camposConcluidos, setCamposConcluidos] = useState<boolean>(false);

  // Estados de Criação de Layout (Menu de Opções)
  const [modalNovoLayoutAberto, setModalNovoLayoutAberto] = useState(false);
  const [carregandoPdfModelo, setCarregandoPdfModelo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Alterna o acordeão: se já estiver aberto, fecha (null); se fechado, abre.
  const alternarEtapa = (etapa: "layout" | "campos" | "validacoes") => {
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
  const [desenhando, setDesenhando] = useState(false);
  const [inicioPos, setInicioPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [retanguloAtual, setRetanguloAtual] = useState<{
    x: number;
    y: number;
    largura: number;
    altura: number;
  } | null>(null);

  const [campoEmEdicaoId, setCampoEmEdicaoId] = useState<string | null>(null);
  const [nomeCampo, setNomeCampo] = useState("");
  const [paginaCampo, setPaginaCampo] = useState<number>(1);
  const [paginaAtivaCanvas, setPaginaAtivaCanvas] = useState<number>(1);
  const [ehIdentificador, setEhIdentificador] = useState(false);
  const [textoEsperado, setTextoEsperado] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // ==========================================
  // GESTÃO DE LAYOUT E IMPORTAÇÃO DE MODELO
  // ==========================================
  const iniciarCriacaoManual = () => {
    setModalNovoLayoutAberto(false);
    setLayoutSelecionadoId("");
    setCliente("PM Sertãozinho - SP");
    setNomeModelo("");
    setOrientacao("Paisagem");
    setFormatoPapel("A4");
    setLarguraMm(70);
    setAlturaMm(30);
    setQuantidadePaginasPadrao(1);
    setCampos([]);
    setQueries([]);
    setPaginasModelo([]);
    setNomeArquivoModelo("");

    setLayoutConcluido(false);
    setCamposConcluidos(false);
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

      setLayoutSelecionadoId("");
      setCliente("PM Sertãozinho - SP");
      setNomeModelo(arquivo.name.replace(/\.[^/.]+$/, ""));
      setOrientacao(dados.orientacao);
      setFormatoPapel(dados.formatoPapel);
      setLarguraMm(dados.larguraMm);
      setAlturaMm(dados.alturaMm);
      setQuantidadePaginasPadrao(dados.quantidadePaginas);
      setPaginasModelo(dados.paginasBase64);
      setNomeArquivoModelo(dados.nomeArquivo);

      setCampos([]);
      setQueries([]);
      setLayoutConcluido(false);
      setCamposConcluidos(false);
      setEtapaAberta("layout");
      setPaginaAtivaCanvas(1);
      setPaginaCampo(1);
      cancelarEdicaoCampo();
      cancelarEdicaoQuery();

      alert(
        `PDF "${dados.nomeArquivo}" carregado com sucesso!\n• Páginas: ${dados.quantidadePaginas}\n• Dimensões: ${dados.larguraMm} x ${dados.alturaMm} mm (${dados.formatoPapel})`,
      );
    } catch (err: any) {
      alert(`Erro na leitura do modelo: ${err.message}`);
    } finally {
      setCarregandoPdfModelo(false);
    }
  };

  const carregarLayout = (nomeLayout: string) => {
    const layout = layoutsSalvos.find((l) => l.nomeModelo === nomeLayout);
    if (!layout) return;

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

    setLayoutConcluido(true);
    setCamposConcluidos(true);
    setEtapaAberta("layout");
    setPaginaAtivaCanvas(1);
    setPaginaCampo(1);
    cancelarEdicaoCampo();
    cancelarEdicaoQuery();
  };

  const salvarNoBanco = (
    novosCampos?: RegiaoCampo[],
    novasQueries?: QueryValidacao[],
  ) => {
    const layoutFinal: LayoutCliente = {
      cliente,
      nomeModelo: nomeModelo.trim(),
      versao: 1,
      orientacao,
      formatoPapel,
      larguraPaginaMm: larguraMm,
      alturaPaginaMm: alturaMm,
      quantidadePaginasPadrao,
      campos: novosCampos || campos,
      queriesValidacao: novasQueries || queries,
      paginasModeloBase64: paginasModelo,
      nomeArquivoModelo,
    };

    if (layoutSelecionadoId) {
      onSalvarLayouts(
        layoutsSalvos.map((l) =>
          l.nomeModelo === layoutSelecionadoId ? layoutFinal : l,
        ),
      );
    } else {
      onSalvarLayouts([...layoutsSalvos, layoutFinal]);
      setLayoutSelecionadoId(layoutFinal.nomeModelo);
    }
  };

  // ==========================================
  // FUNÇÕES DA ETAPA 1 (LAYOUT)
  // ==========================================
  const salvarEtapaLayout = () => {
    if (!nomeModelo.trim()) {
      alert("Informe o nome do layout antes de continuar.");
      return;
    }
    salvarNoBanco();
    setLayoutConcluido(true);
    setEtapaAberta("campos");
  };

  // ==========================================
  // FUNÇÕES DA ETAPA 2 (CAMPOS CARTESIANOS)
  // ==========================================
  const iniciarSelecao = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.round(e.clientX - rect.left));
    const y = Math.max(0, Math.round(e.clientY - rect.top));
    setInicioPos({ x, y });
    setRetanguloAtual({ x, y, largura: 0, altura: 0 });
    setDesenhando(true);
  };

  const atualizandoSelecao = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!desenhando || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = Math.max(
      0,
      Math.min(larguraVisualPx, Math.round(e.clientX - rect.left)),
    );
    const cursorY = Math.max(
      0,
      Math.min(alturaVisualPx, Math.round(e.clientY - rect.top)),
    );

    const x = Math.min(inicioPos.x, cursorX);
    const y = Math.min(inicioPos.y, cursorY);
    const largura = Math.abs(cursorX - inicioPos.x);
    const altura = Math.abs(cursorY - inicioPos.y);

    setRetanguloAtual({ x, y, largura, altura });
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
    setRetanguloAtual({
      x: Math.round(campo.xMm * escalaPxPorMm),
      y: Math.round(campo.yMm * escalaPxPorMm),
      largura: Math.round(campo.larguraMm * escalaPxPorMm),
      altura: Math.round(campo.alturaMm * escalaPxPorMm),
    });
  };

  const cancelarEdicaoCampo = () => {
    setCampoEmEdicaoId(null);
    setNomeCampo("");
    setPaginaCampo(paginaAtivaCanvas);
    setEhIdentificador(false);
    setTextoEsperado("");
    setRetanguloAtual(null);
  };

  const salvarRegiaoCampo = () => {
    if (
      !retanguloAtual ||
      retanguloAtual.largura < 8 ||
      retanguloAtual.altura < 8
    ) {
      alert("Desenhe ou selecione uma região válida sobre o documento.");
      return;
    }
    if (!nomeCampo.trim()) {
      alert("Informe o nome do campo.");
      return;
    }
    if (
      campos.some(
        (c) =>
          c.nomeCampo.toLowerCase() === nomeCampo.trim().toLowerCase() &&
          c.id !== campoEmEdicaoId,
      )
    ) {
      alert("Já existe um campo com este nome. Escolha outro.");
      return;
    }

    const xMm = Number((retanguloAtual.x / escalaPxPorMm).toFixed(2));
    const yMm = Number((retanguloAtual.y / escalaPxPorMm).toFixed(2));
    const larguraRegiaoMm = Number(
      (retanguloAtual.largura / escalaPxPorMm).toFixed(2),
    );
    const alturaRegiaoMm = Number(
      (retanguloAtual.altura / escalaPxPorMm).toFixed(2),
    );

    const payloadCampo: RegiaoCampo = {
      id: campoEmEdicaoId || crypto.randomUUID(),
      nomeCampo: nomeCampo.trim(),
      pagina: Number(paginaCampo),
      xMm,
      yMm,
      larguraMm: larguraRegiaoMm,
      alturaMm: alturaRegiaoMm,
      ehIdentificadorPrimeiraPagina: ehIdentificador,
      textoEsperadoIdentificador: ehIdentificador
        ? textoEsperado.trim()
        : undefined,
    };

    const novosCampos = campoEmEdicaoId
      ? campos.map((c) => (c.id === campoEmEdicaoId ? payloadCampo : c))
      : [...campos, payloadCampo];

    setCampos(novosCampos);
    salvarNoBanco(novosCampos, queries);
    cancelarEdicaoCampo();
  };

  const removerRegiaoCampo = (id: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja apagar o campo "${nome}"?`)) {
      const novos = campos.filter((c) => c.id !== id);
      setCampos(novos);
      salvarNoBanco(novos, queries);
      if (campoEmEdicaoId === id) cancelarEdicaoCampo();
    }
  };

  const salvarEtapaCampos = () => {
    if (campos.length === 0) {
      if (
        !window.confirm(
          "Nenhum campo foi configurado. Deseja avançar sem campos?",
        )
      )
        return;
    }
    setCamposConcluidos(true);
    setEtapaAberta("validacoes");
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
      alert("Informe a instrução SQL.");
      return;
    }

    const comandosBloqueados =
      /\b(UPDATE|DELETE|INSERT|EXEC|EXECUTE|DROP|ALTER|CREATE|TRUNCATE|MERGE)\b/i;
    if (comandosBloqueados.test(texto)) {
      alert(
        "ERRO DE SEGURANÇA: São permitidas apenas consultas somente leitura (SELECT).",
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
      alert(
        `ERRO: Os seguintes parâmetros não existem nos campos do layout: ${parametrosInvalidos.join(
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
      alert(
        "ATENÇÃO: Não foi possível identificar os campos de retorno. Utilize 'AS NomeVariavel' na query.",
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
      alert("Selecione os campos para criar a validação.");
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
      alert("Informe um nome para a Query de Validação.");
      return;
    }
    if (!sqlAnalisado) {
      alert("Você precisa analisar a instrução SQL antes de salvar.");
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
    salvarNoBanco(campos, novas);
    cancelarEdicaoQuery();
  };

  const removerQuery = (id: string, nome: string) => {
    if (window.confirm(`Deseja remover a query "${nome}" e suas validações?`)) {
      const novas = queries.filter((q) => q.id !== id);
      setQueries(novas);
      salvarNoBanco(campos, novas);
    }
  };

  const editarQuery = (query: QueryValidacao) => {
    setQueryEmEdicaoId(query.id);
    setNomeQuery(query.nome);
    setSqlQuery(query.sql);
    setParametrosEncontrados(query.parametrosEncontrados);
    setCamposRetornados(query.camposRetornados);
    setRegrasAtuais(query.regras);
    setSqlAnalisado(true);
    if (query.camposRetornados.length > 0)
      setRegraCampoRetornado(query.camposRetornados[0]);
    if (campos.length > 0) setRegraCampoCarne(campos[0].nomeCampo);
  };

  return (
    <div id="container-parametrizacao">
      {/* Estilos da animação de abertura/fechamento dos acordeões */}
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
        `}
      </style>

      {/* Input Oculto de Upload de PDF de Modelo */}
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
              <option value="" disabled>
                (Selecione um layout)
              </option>
              {layoutsSalvos.map((layout) => (
                <option key={layout.nomeModelo} value={layout.nomeModelo}>
                  {layout.nomeModelo} ({layout.cliente})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Menu "+ Novo Layout" */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setModalNovoLayoutAberto(!modalNovoLayoutAberto)}
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
            <span>
              {carregandoPdfModelo ? "Processando..." : "Novo Layout"}
            </span>
            <span style={{ fontSize: "0.65rem" }}>▼</span>
          </button>

          {modalNovoLayoutAberto && (
            <div
              style={{
                position: "absolute",
                top: "105%",
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
        }}
      >
        <div
          onClick={() => alternarEtapa("layout")}
          style={{
            backgroundColor: etapaAberta === "layout" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor: "pointer",
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
              1. Configurações do layout
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
            etapaAberta === "layout"
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
              marginBottom: "20px",
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

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={salvarEtapaLayout}
              style={{
                backgroundColor: "#009688",
                color: "#ffffff",
                border: "none",
                padding: "7px 20px",
                borderRadius: "4px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <span>Salvar</span>
              <span>→</span>
            </button>
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
          opacity: !layoutConcluido ? 0.65 : 1,
        }}
      >
        <div
          onClick={() => {
            if (layoutConcluido) alternarEtapa("campos");
          }}
          style={{
            backgroundColor: etapaAberta === "campos" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor: layoutConcluido ? "pointer" : "not-allowed",
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
              {!layoutConcluido ? "🔒" : etapaAberta === "campos" ? "▼" : "▶"}
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
            {campos.length} campo(s) parametrizado(s)
          </span>
        </div>

        <div
          className={`accordion-content-wrapper ${
            etapaAberta === "campos" && layoutConcluido
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
            {/* CANVAS CARTESIANO COM BARRA DE FERRAMENTAS ESTILO EMPRESA */}
            <div
              id="coluna-canvas-documento"
              style={{
                flex: "1 1 auto",
                maxWidth: "100%",
                overflow: "auto",
              }}
            >
              {/* BARRA DE FERRAMENTAS DO CANVAS */}
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

                {/* Controle de Opacidade */}
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

                {/* Zoom */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setZoomNivel(Math.max(50, zoomNivel - 15))}
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
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      minWidth: "36px",
                      textAlign: "center",
                    }}
                  >
                    {zoomNivel}% (Zoom)
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomNivel(Math.min(200, zoomNivel + 15))}
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

                {/* Botões das Páginas */}
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
                          setRetanguloAtual(null);
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

              {/* ÁREA DO CANVAS */}
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
                  backgroundColor: "#ffffff",
                  border: "1px solid #90a4ae",
                  borderRadius: "4px",
                  overflow: "hidden",
                  cursor: "crosshair",
                  userSelect: "none",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
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
                      <span style={{ color: "#009688", fontWeight: 700 }}>
                        PÁGINA {paginaAtivaCanvas}
                      </span>
                    </div>
                  </div>
                )}

                {campos
                  .filter((campo) => (campo.pagina || 1) === paginaAtivaCanvas)
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

                {retanguloAtual && paginaCampo === paginaAtivaCanvas && (
                  <div
                    id="retangulo-selecao-ativa"
                    style={{
                      position: "absolute",
                      left: `${retanguloAtual.x}px`,
                      top: `${retanguloAtual.y}px`,
                      width: `${retanguloAtual.largura}px`,
                      height: `${retanguloAtual.altura}px`,
                      border: "2px dashed #d32f2f",
                      backgroundColor: "rgba(211, 47, 47, 0.2)",
                      pointerEvents: "none",
                      boxSizing: "border-box",
                    }}
                  ></div>
                )}
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
                    {campoEmEdicaoId ? "Editar Campo" : "Novo Campo"}
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

                  {retanguloAtual && (
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
                      {(retanguloAtual.x / escalaPxPorMm).toFixed(1)} | Y:{" "}
                      {(retanguloAtual.y / escalaPxPorMm).toFixed(1)} | L:{" "}
                      {(retanguloAtual.largura / escalaPxPorMm).toFixed(1)} | A:{" "}
                      {(retanguloAtual.altura / escalaPxPorMm).toFixed(1)}
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
                              title="Excluir"
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

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid #eceff1",
            }}
          >
            <button
              onClick={salvarEtapaCampos}
              style={{
                backgroundColor: "#009688",
                color: "#ffffff",
                border: "none",
                padding: "7px 20px",
                borderRadius: "4px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <span>Salvar</span>
              <span>→</span>
            </button>
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
          opacity: !camposConcluidos ? 0.65 : 1,
        }}
      >
        <div
          onClick={() => {
            if (camposConcluidos) alternarEtapa("validacoes");
          }}
          style={{
            backgroundColor:
              etapaAberta === "validacoes" ? "#e0f2f1" : "#f8fafc",
            padding: "10px 16px",
            cursor: camposConcluidos ? "pointer" : "not-allowed",
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
              {!camposConcluidos
                ? "🔒"
                : etapaAberta === "validacoes"
                  ? "▼"
                  : "▶"}
            </span>
            <strong
              style={{
                fontSize: "0.9rem",
                color: etapaAberta === "validacoes" ? "#00796b" : "#263238",
              }}
            >
              3. Regras de Validação
            </strong>
          </div>

          <span style={{ fontSize: "0.75rem", color: "#546e7a" }}>
            {queries.length} query(ies) ativa(s)
          </span>
        </div>

        <div
          className={`accordion-content-wrapper ${
            etapaAberta === "validacoes" && camposConcluidos
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
                  Instrução T-SQL (utilize $campo para referenciar campos)
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

              <button
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
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Analisar</span>
              </button>

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
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
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
                        Campo no Carnê
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

                  {/* TABELA DE REGRAS NO ESTILO DA EMPRESA */}
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
                        <th style={{ padding: "6px 8px" }}>Campo DB</th>
                        <th
                          style={{
                            padding: "6px 8px",
                            textAlign: "center",
                          }}
                        >
                          Operador
                        </th>
                        <th style={{ padding: "6px 8px" }}>Campo Carnê</th>
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
                      Salvar Query
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
                  CONSULTAS CONFIGURADAS ({queries.length})
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
                        {q.regras.length} regra(s) vinculada(s)
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
                          Excluir
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
    </div>
  );
}
