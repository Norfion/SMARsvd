import { useState, useRef } from "react";
import type {
  OrientacaoPagina,
  FormatoPapel,
  RegiaoCampo,
  LayoutCliente,
} from "../types/layout";

interface ParametrizacaoPageProps {
  layoutsSalvos: LayoutCliente[];
  onSalvarLayouts: (layouts: LayoutCliente[]) => void;
}

export function ParametrizacaoPage({
  layoutsSalvos,
  onSalvarLayouts,
}: ParametrizacaoPageProps) {
  // Lista de municípios/clientes da empresa
  const CLIENTES_DISPONIVEIS = [
    "PM Sertãozinho - SP",
    "PM Serra - ES",
    "PM Birigui - SP",
    "PM Araraquara - SP",
    "Outro / Geral",
  ];

  const layoutInicial = layoutsSalvos[0];

  const [cliente, setCliente] = useState<string>(
    layoutInicial ? layoutInicial.cliente : "PM Sertãozinho - SP",
  );
  const [nomeModelo, setNomeModelo] = useState<string>(
    layoutInicial ? layoutInicial.nomeModelo : "Carnê Geral 2026 - Padrão",
  );

  // Metadados do Layout da Página em mm
  const [orientacao, setOrientacao] = useState<OrientacaoPagina>(
    layoutInicial ? layoutInicial.orientacao : "Paisagem",
  );
  const [formatoPapel, setFormatoPapel] = useState<FormatoPapel>(
    layoutInicial ? layoutInicial.formatoPapel : "Personalizado",
  );
  const [larguraMm, setLarguraMm] = useState<number>(
    layoutInicial ? layoutInicial.larguraPaginaMm : 70,
  );
  const [alturaMm, setAlturaMm] = useState<number>(
    layoutInicial ? layoutInicial.alturaPaginaMm : 30,
  );

  // Largura visual fixa no navegador para desenhar confortavelmente
  const LARGURA_CONTAINER_PX = 800;
  // Fator de escala: quantos pixels equivalem a 1 mm
  const escalaPxPorMm = LARGURA_CONTAINER_PX / (larguraMm || 1);
  const alturaContainerPx = Math.round(alturaMm * escalaPxPorMm);

  const [campos, setCampos] = useState<RegiaoCampo[]>(
    layoutInicial ? layoutInicial.campos : [],
  );

  // Estados de demarcação do retângulo
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

  // Estados do formulário de região
  const [campoEmEdicaoId, setCampoEmEdicaoId] = useState<string | null>(null);
  const [nomeCampo, setNomeCampo] = useState("");
  const [consultaSql, setConsultaSql] = useState("");
  const [ehIdentificador, setEhIdentificador] = useState(false);
  const [textoEsperado, setTextoEsperado] = useState("");

  const [layoutEmEdicaoId, setLayoutEmEdicaoId] = useState<string | null>(
    layoutInicial ? layoutInicial.nomeModelo : null,
  );

  // Carrega todas as informações do layout para os estados do editor
  const carregarLayoutParaEdicao = (layout: LayoutCliente) => {
    setLayoutEmEdicaoId(layout.nomeModelo);
    setCliente(layout.cliente);
    setNomeModelo(layout.nomeModelo);
    setOrientacao(layout.orientacao);
    setFormatoPapel(layout.formatoPapel);
    setLarguraMm(layout.larguraPaginaMm);
    setAlturaMm(layout.alturaPaginaMm);
    setCampos(layout.campos);
    cancelarEdicao();
  };

  // Reseta os campos para o padrão de criação de um novo layout
  const limparFormularioLayout = () => {
    setLayoutEmEdicaoId(null);
    setNomeModelo("");
    setCampos([]);
    cancelarEdicao();
  };

  // Exclui o layout selecionado da lista
  const removerLayout = (nome: string) => {
    const confirmou = window.confirm(`Deseja excluir o layout "${nome}"?`);
    if (confirmou) {
      const novaLista = layoutsSalvos.filter((l) => l.nomeModelo !== nome);
      onSalvarLayouts(novaLista);
      if (layoutEmEdicaoId === nome) {
        limparFormularioLayout();
      }
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  const iniciarSelecao = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    setInicioPos({ x, y });
    setRetanguloAtual({ x, y, largura: 0, altura: 0 });
    setDesenhando(true);
  };

  const atualizandoSelecao = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!desenhando || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = Math.round(e.clientX - rect.left);
    const cursorY = Math.round(e.clientY - rect.top);

    const x = Math.min(inicioPos.x, cursorX);
    const y = Math.min(inicioPos.y, cursorY);
    const largura = Math.abs(cursorX - inicioPos.x);
    const altura = Math.abs(cursorY - inicioPos.y);

    setRetanguloAtual({ x, y, largura, altura });
  };

  const finalizarSelecao = () => {
    setDesenhando(false);
  };

  // Carrega os dados do campo selecionado de volta para o formulário
  const iniciarEdicao = (campo: RegiaoCampo) => {
    setCampoEmEdicaoId(campo.id);
    setNomeCampo(campo.nomeCampo);
    setConsultaSql(campo.consultaSql);
    setEhIdentificador(!!campo.ehIdentificadorPrimeiraPagina);
    setTextoEsperado(campo.textoEsperadoIdentificador || "");
    setRetanguloAtual({
      x: campo.xMm * escalaPxPorMm,
      y: campo.yMm * escalaPxPorMm,
      largura: campo.larguraMm * escalaPxPorMm,
      altura: campo.alturaMm * escalaPxPorMm,
    });
  };

  const cancelarEdicao = () => {
    setCampoEmEdicaoId(null);
    setNomeCampo("");
    setConsultaSql("");
    setEhIdentificador(false);
    setTextoEsperado("");
    setRetanguloAtual(null);
  };

  const salvarCampo = () => {
    if (
      !retanguloAtual ||
      retanguloAtual.largura < 10 ||
      retanguloAtual.altura < 10
    ) {
      alert("Desenhe ou selecione uma região válida sobre o documento.");
      return;
    }
    if (!nomeCampo.trim()) {
      alert("Informe o nome do campo.");
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
      xMm,
      yMm,
      larguraMm: larguraRegiaoMm,
      alturaMm: alturaRegiaoMm,
      consultaSql:
        consultaSql.trim() ||
        "SELECT ValorEsperado FROM Tabela WHERE Documento = @Documento;",
      ehIdentificadorPrimeiraPagina: ehIdentificador,
      textoEsperadoIdentificador: ehIdentificador
        ? textoEsperado.trim()
        : undefined,
    };

    if (campoEmEdicaoId) {
      setCampos(
        campos.map((c) => (c.id === campoEmEdicaoId ? payloadCampo : c)),
      );
      setCampoEmEdicaoId(null);
    } else {
      setCampos([...campos, payloadCampo]);
    }

    cancelarEdicao();
  };

  const removerCampo = (id: string, nome: string) => {
    const confirmou = window.confirm(
      `Tem certeza que deseja apagar o campo "${nome}"?`,
    );
    if (confirmou) {
      setCampos(campos.filter((c) => c.id !== id));
      if (campoEmEdicaoId === id) {
        cancelarEdicao();
      }
    }
  };

  const salvarLayoutCompleto = () => {
    if (!nomeModelo.trim()) {
      alert("Informe o nome do layout antes de salvar.");
      return;
    }

    const layoutFinal: LayoutCliente = {
      cliente,
      nomeModelo: nomeModelo.trim(),
      versao: 1,
      orientacao,
      formatoPapel,
      larguraPaginaMm: larguraMm,
      alturaPaginaMm: alturaMm,
      campos,
    };

    if (layoutEmEdicaoId) {
      const confirmou = window.confirm(
        `Tem certeza de que deseja atualizar as configurações do layout "${layoutEmEdicaoId}"?`,
      );
      if (!confirmou) {
        return;
      }
      const listaAtualizada = layoutsSalvos.map((l) =>
        l.nomeModelo === layoutEmEdicaoId ? layoutFinal : l,
      );
      onSalvarLayouts(listaAtualizada);
      setLayoutEmEdicaoId(layoutFinal.nomeModelo);
      alert(`Layout "${layoutFinal.nomeModelo}" atualizado com sucesso!`);
    } else {
      onSalvarLayouts([...layoutsSalvos, layoutFinal]);
      setLayoutEmEdicaoId(layoutFinal.nomeModelo);
      alert(`Novo layout "${layoutFinal.nomeModelo}" salvo com sucesso!`);
    }
  };

  return (
    <div
      id="container-editor-layouts"
      style={{
        maxWidth: "1320px",
        margin: "0 auto",
        padding: "0",
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      {/* Barra de Propriedades Gerais e Dimensões do PDF */}
      <div
        id="barra-propriedades-layout"
        style={{
          backgroundColor: "#fff",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #cbd5e1",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "flex-end",
        }}
      >
        {/* Campo Cliente / Município */}
        <div id="grupo-campo-cliente" style={{ minWidth: "200px" }}>
          <label
            htmlFor="select-cliente"
            id="label-cliente"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Cliente / Município:
          </label>
          <select
            id="select-cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            {CLIENTES_DISPONIVEIS.map((c) => (
              <option key={c} id={`opcao-cliente-${c}`} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div
          id="grupo-campo-nome-modelo"
          style={{ flex: 2, minWidth: "220px" }}
        >
          <label
            htmlFor="input-nome-modelo"
            id="label-nome-modelo"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Nome do layout:
          </label>
          <input
            id="input-nome-modelo"
            type="text"
            value={nomeModelo}
            onChange={(e) => setNomeModelo(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          ></input>
        </div>

        <div id="grupo-campo-orientacao">
          <label
            htmlFor="select-orientacao-pagina"
            id="label-orientacao-pagina"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Orientação:
          </label>
          <select
            id="select-orientacao-pagina"
            value={orientacao}
            onChange={(e) => setOrientacao(e.target.value as OrientacaoPagina)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option id="opcao-orientacao-paisagem" value="Paisagem">
              Paisagem (Horizontal)
            </option>
            <option id="opcao-orientacao-retrato" value="Retrato">
              Retrato (Vertical)
            </option>
          </select>
        </div>

        <div id="grupo-campo-formato-papel">
          <label
            htmlFor="select-formato-papel"
            id="label-formato-papel"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Tamanho:
          </label>
          <select
            id="select-formato-papel"
            value={formatoPapel}
            onChange={(e) => setFormatoPapel(e.target.value as FormatoPapel)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option id="opcao-papel-a4" value="A4">
              A4
            </option>
            <option id="opcao-papel-carta" value="Carta">
              Carta
            </option>
            <option id="opcao-papel-personalizado" value="Personalizado">
              Personalizado
            </option>
          </select>
        </div>

        <div id="grupo-campo-largura-mm" style={{ width: "110px" }}>
          <label
            htmlFor="input-largura-mm"
            id="label-largura-mm"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Largura (mm):
          </label>
          <input
            id="input-largura-mm"
            type="number"
            value={larguraMm}
            onChange={(e) => setLarguraMm(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          ></input>
        </div>

        <div id="grupo-campo-altura-mm" style={{ width: "110px" }}>
          <label
            htmlFor="input-altura-mm"
            id="label-altura-mm"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Altura (mm):
          </label>
          <input
            id="input-altura-mm"
            type="number"
            value={alturaMm}
            onChange={(e) => setAlturaMm(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          ></input>
        </div>

        {/* Seletor de layouts existentes */}
        <div id="grupo-seletor-layouts" style={{ minWidth: "260px" }}>
          <label
            htmlFor="select-layout-existente"
            id="label-layout-existente"
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "4px",
            }}
          >
            Carregar Layout Existente:
          </label>
          <select
            id="select-layout-existente"
            value={layoutEmEdicaoId || ""}
            onChange={(e) => {
              const selecionado = layoutsSalvos.find(
                (l) => l.nomeModelo === e.target.value,
              );
              if (selecionado) {
                carregarLayoutParaEdicao(selecionado);
              }
            }}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            {layoutsSalvos.map((layout) => (
              <option key={layout.nomeModelo} value={layout.nomeModelo}>
                {layout.nomeModelo} — ({layout.cliente})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            id="btn-salvar-layout"
            onClick={salvarLayoutCompleto}
            style={{
              backgroundColor: layoutEmEdicaoId ? "#ea580c" : "#16a34a",
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              height: "40px",
            }}
          >
            {layoutEmEdicaoId ? "Atualizar Layout" : "Salvar Novo Layout"}
          </button>

          {layoutEmEdicaoId && (
            <button
              id="btn-novo-layout"
              onClick={limparFormularioLayout}
              style={{
                marginLeft: "auto",
                backgroundColor: "#16a34a",
                color: "#fff",
                border: "none",
                padding: "10px 14px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
                height: "40px",
              }}
            >
              Criar Novo
            </button>
          )}

          {layoutEmEdicaoId && (
            <button
              id="btn-remover-layout"
              onClick={() => removerLayout(layoutEmEdicaoId)}
              style={{
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
                padding: "10px 14px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
                height: "40px",
              }}
            >
              Excluir Layout
            </button>
          )}
        </div>
      </div>

      {/* Grid com o Canvas de Seleção e os Controles */}
      <div
        id="grid-principal-editor"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* Painel do Documento */}
        <div
          id="coluna-canvas-documento"
          style={{
            flex: "1 1 auto",
            maxWidth: "100%",
            overflow: "auto",
          }}
        >
          <div
            id="rotulo-dimensoes-documento"
            style={{
              marginBottom: "8px",
              fontWeight: 600,
              color: "#334155",
              fontSize: "0.9rem",
            }}
          >
            Área do Documento ({orientacao} — {larguraMm} x {alturaMm}mm):
          </div>

          <div
            id="canvas-area-demarcacao"
            ref={containerRef}
            onMouseDown={iniciarSelecao}
            onMouseMove={atualizandoSelecao}
            onMouseUp={finalizarSelecao}
            style={{
              position: "relative",
              width: `${LARGURA_CONTAINER_PX}px`,
              height: `${alturaContainerPx}px`,
              backgroundColor: "#fff",
              border: "2px dashed #94a3b8",
              borderRadius: "8px",
              overflow: "hidden",
              cursor: "crosshair",
              userSelect: "none",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          >
            {/* Mock do Carnê */}
            <div
              id="mock-preview-carne"
              style={{ padding: "18px", color: "#64748b" }}
            >
              <div
                id="mock-cabecalho-carne"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "2px solid #000",
                  paddingBottom: "6px",
                }}
              >
                <strong id="mock-orgao-emissor" style={{ fontSize: "0.9rem" }}>
                  PREFEITURA MUNICIPAL — SECRETARIA DA FAZENDA
                </strong>
                <span id="mock-exercicio-ano" style={{ fontSize: "0.85rem" }}>
                  CARNÊ EXERCÍCIO 2026
                </span>
              </div>

              <div
                id="mock-grid-dados-carne"
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div
                  id="mock-box-contribuinte"
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                >
                  <small id="mock-label-contribuinte">Contribuinte:</small>
                  <p
                    id="mock-valor-contribuinte"
                    style={{
                      color: "#000",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    JOSÉ RONICLAUDIO DE LIMA
                  </p>
                </div>
                <div
                  id="mock-box-inscricao"
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                >
                  <small id="mock-label-inscricao">Inscrição Municipal:</small>
                  <p
                    id="mock-valor-inscricao"
                    style={{
                      color: "#000",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    01-0941-1-0018-000
                  </p>
                </div>
                <div
                  id="mock-box-parcela"
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                >
                  <small id="mock-label-parcela">Nº Documento / Parcela:</small>
                  <p
                    id="mock-valor-parcela"
                    style={{
                      color: "#000",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    27480056 - Parc 10/10
                  </p>
                </div>
                <div
                  id="mock-box-valor-total"
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                >
                  <small id="mock-label-valor-total">Valor Total:</small>
                  <p
                    id="mock-valor-total"
                    style={{
                      color: "#000",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    R$ 395,07
                  </p>
                </div>
              </div>

              <div
                id="mock-box-codigo-barras"
                style={{
                  marginTop: "20px",
                  border: "1px solid #94a3b8",
                  height: "100px",
                  padding: "8px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <small id="mock-label-codigo-barras">
                  Linha Digitável / Ficha de Compensação:
                </small>
                <p
                  id="mock-linha-digitavel"
                  style={{
                    fontFamily: "monospace",
                    marginTop: "8px",
                    letterSpacing: "1px",
                    fontSize: "0.8rem",
                  }}
                >
                  23790.18506 99900.263296 80009.913403 1 15700000039507
                </p>
              </div>
            </div>

            {/* Caixas demarcadas */}
            {campos.map((campo) => {
              const estaSendoEditado = campo.id === campoEmEdicaoId;
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
                    border: estaSendoEditado
                      ? "2px solid #ea580c"
                      : ehAnchor
                        ? "2px solid #7c3aed"
                        : "2px solid #2563eb",
                    backgroundColor: estaSendoEditado
                      ? "rgba(234, 88, 12, 0.2)"
                      : ehAnchor
                        ? "rgba(124, 58, 237, 0.2)"
                        : "rgba(37, 99, 235, 0.15)",
                    color: estaSendoEditado
                      ? "#c2410c"
                      : ehAnchor
                        ? "#6d28d9"
                        : "#1d4ed8",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "2px 4px",
                    pointerEvents: "none",
                  }}
                >
                  {ehAnchor
                    ? `🚩 [Início] ${campo.nomeCampo}`
                    : campo.nomeCampo}
                </div>
              );
            })}

            {/* Retângulo ativo no arraste */}
            {retanguloAtual && (
              <div
                id="retangulo-selecao-ativa"
                style={{
                  position: "absolute",
                  left: `${retanguloAtual.x}px`,
                  top: `${retanguloAtual.y}px`,
                  width: `${retanguloAtual.largura}px`,
                  height: `${retanguloAtual.altura}px`,
                  border: "2px dashed #dc2626",
                  backgroundColor: "rgba(220, 38, 38, 0.15)",
                  pointerEvents: "none",
                }}
              ></div>
            )}
          </div>
        </div>

        {/* Painel do Formulário */}
        <div
          id="coluna-controles-formulario"
          style={{
            flex: "1 1 340px",
            minWidth: "280px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div
            id="painel-edicao-regiao"
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
            }}
          >
            <div
              id="cabecalho-edicao-regiao"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h3
                id="titulo-modo-edicao"
                style={{ fontSize: "1.05rem", color: "#1e293b" }}
              >
                {campoEmEdicaoId ? "Editar Região" : "Nova Região Selecionada"}
              </h3>
              {campoEmEdicaoId && (
                <button
                  id="btn-cancelar-edicao"
                  onClick={cancelarEdicao}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>

            {/* 1. Nome do Campo */}
            <div id="grupo-campo-nome-regiao" style={{ marginBottom: "14px" }}>
              <label
                htmlFor="input-nome-regiao"
                id="label-nome-regiao"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Nome do Campo:
              </label>
              <input
                id="input-nome-regiao"
                type="text"
                placeholder="Ex: idOrigem, idGuia, Exercicio"
                value={nomeCampo}
                onChange={(e) => setNomeCampo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              ></input>
            </div>

            {/* 2. Botão Liga/Desliga para Identificador (embaixo do Nome do Campo) */}
            <div
              id="painel-delimitador-pagina"
              style={{
                backgroundColor: ehIdentificador ? "#f5f3ff" : "#f8fafc",
                padding: "12px",
                borderRadius: "8px",
                border: ehIdentificador
                  ? "1px solid #c4b5fd"
                  : "1px solid #cbd5e1",
                marginBottom: "14px",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span
                  id="label-toggle-identificador"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: ehIdentificador ? "#5b21b6" : "#1e293b",
                  }}
                >
                  Identificador de Início do Carnê:
                </span>

                <button
                  id="btn-toggle-identificador"
                  type="button"
                  role="switch"
                  aria-checked={ehIdentificador}
                  onClick={() => setEhIdentificador(!ehIdentificador)}
                  style={{
                    position: "relative",
                    width: "48px",
                    height: "26px",
                    borderRadius: "13px",
                    backgroundColor: ehIdentificador ? "#7c3aed" : "#cbd5e1",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    transition: "background-color 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    id="indicador-toggle-switch"
                    style={{
                      display: "block",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      transform: ehIdentificador
                        ? "translateX(22px)"
                        : "translateX(0px)",
                      transition: "transform 0.2s ease",
                    }}
                  ></span>
                </button>
              </div>
            </div>

            {/* 3. Alternância: Se for Identificador exibe Texto Esperado; se não for, exibe Consulta SQL */}
            {ehIdentificador ? (
              <div
                id="grupo-texto-esperado-ancora"
                style={{ marginBottom: "14px" }}
              >
                <label
                  htmlFor="input-texto-esperado-ancora"
                  id="label-texto-esperado-ancora"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#5b21b6",
                    marginBottom: "4px",
                  }}
                >
                  Texto exato esperado nesta região:
                </label>
                <input
                  id="input-texto-esperado-ancora"
                  type="text"
                  placeholder="Ex.: MUNICÍPIO DE SERTÃOZINHO"
                  value={textoEsperado}
                  onChange={(e) => setTextoEsperado(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #c4b5fd",
                    fontSize: "0.85rem",
                  }}
                ></input>
              </div>
            ) : (
              <div id="grupo-consulta-sql" style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="textarea-consulta-sql"
                  id="label-consulta-sql"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Instrução SQL Server (Validação):
                </label>
                <textarea
                  id="textarea-consulta-sql"
                  rows={2}
                  placeholder="SELECT C.Nome FROM Contribuintes C WHERE C.CRC = @idOrigem;"
                  value={consultaSql}
                  onChange={(e) => setConsultaSql(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  }}
                ></textarea>
              </div>
            )}

            <button
              id="btn-submeter-regiao"
              onClick={salvarCampo}
              style={{
                width: "100%",
                backgroundColor: campoEmEdicaoId ? "#ea580c" : "#2563eb",
                color: "#fff",
                border: "none",
                padding: "10px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {campoEmEdicaoId
                ? "Atualizar Região"
                : "Vincular Região ao Layout"}
            </button>
          </div>

          {/* Listagem de Campos */}
          <div
            id="painel-campos-mapeados"
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
            }}
          >
            <h3
              id="titulo-lista-campos"
              style={{
                fontSize: "1.05rem",
                marginBottom: "12px",
                color: "#1e293b",
              }}
            >
              Campos Mapeados ({campos.length})
            </h3>

            {campos.length === 0 ? (
              <p
                id="msg-sem-campos-mapeados"
                style={{ color: "#94a3b8", fontSize: "0.85rem" }}
              >
                Nenhum campo demarcado no carnê.
              </p>
            ) : (
              <ul
                id="lista-campos-mapeados"
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {campos.map((c) => (
                  <li
                    key={c.id}
                    id={`item-campo-${c.id}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div id={`info-campo-${c.id}`}>
                      <strong
                        id={`nome-campo-cadastrado-${c.id}`}
                        style={{
                          display: "block",
                          color: c.ehIdentificadorPrimeiraPagina
                            ? "#6d28d9"
                            : "#0f172a",
                        }}
                      >
                        {c.ehIdentificadorPrimeiraPagina
                          ? `🚩 ${c.nomeCampo} (Identificador)`
                          : c.nomeCampo}
                      </strong>
                      <span
                        id={`coordenadas-campo-${c.id}`}
                        style={{ fontSize: "0.75rem", color: "#64748b" }}
                      >
                        X: {c.xMm}mm | Y: {c.yMm}mm
                        <br />
                        L: {c.larguraMm}mm | A: {c.alturaMm}mm
                      </span>
                    </div>
                    <div
                      id={`acoes-campo-${c.id}`}
                      style={{ display: "flex", gap: "6px" }}
                    >
                      <button
                        id={`btn-editar-campo-${c.id}`}
                        onClick={() => iniciarEdicao(c)}
                        style={{
                          backgroundColor: "#f1f5f9",
                          color: "#334155",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        id={`btn-remover-campo-${c.id}`}
                        onClick={() => removerCampo(c.id, c.nomeCampo)}
                        style={{
                          backgroundColor: "#fee2e2",
                          color: "#991b1b",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Remover
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
  );
}
