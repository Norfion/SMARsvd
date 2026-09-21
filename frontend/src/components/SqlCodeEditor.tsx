import { useState, useRef, useEffect } from "react";

interface SqlCodeEditorProps {
  value: string;
  onChange: (novoValor: string) => void;
  camposDisponiveis: string[];
}

export function SqlCodeEditor({
  value,
  onChange,
  camposDisponiveis,
}: SqlCodeEditorProps) {
  const [expandido, setExpandido] = useState(false);
  const [exibirAutocomplete, setExibirAutocomplete] = useState(false);
  const [indiceFocoSugestao, setIndiceFocoSugestao] = useState(0);
  const [termoBusca, setTermoBusca] = useState("");
  const [posicaoInicioVar, setPosicaoInicioVar] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  // Palavras-chave SQL Server comuns para realce
  const PALAVRAS_CHAVE_SQL = [
    "SELECT",
    "FROM",
    "WHERE",
    "AS",
    "AND",
    "OR",
    "JOIN",
    "INNER",
    "LEFT",
    "RIGHT",
    "ON",
    "ORDER",
    "BY",
    "GROUP",
    "HAVING",
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "TOP",
    "DISTINCT",
    "LIKE",
    "IN",
    "IS",
    "NULL",
    "NOT",
    "BETWEEN",
  ];

  // Sincroniza a rolagem do textarea com o container de syntax highlight
  const aoRolar = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Filtra os campos cadastrados no layout que combinam com o que foi digitado
  const camposFiltrados = camposDisponiveis.filter((c) =>
    c.toLowerCase().includes(termoBusca.toLowerCase()),
  );

  // Analisa se o cursor está logo após um cifrão ($) ou abertura de chave (${)
  const verificarAutocomplete = (texto: string, posCursor: number) => {
    const textoAntesCursor = texto.slice(0, posCursor);
    // Suporta tanto "$termo" quanto "${termo"
    const match = textoAntesCursor.match(
      /(?:\$\{([^\n\r}]*?)|\$([a-zA-Z0-9_]*))$/,
    );

    if (match) {
      const termo = match[1] !== undefined ? match[1] : match[2];
      const matchCompleto = match[0];
      setPosicaoInicioVar(posCursor - matchCompleto.length);
      setTermoBusca(termo);
      setExibirAutocomplete(true);
      setIndiceFocoSugestao(0);
    } else {
      setExibirAutocomplete(false);
      setPosicaoInicioVar(null);
      setTermoBusca("");
    }
  };

  const aoMudarTexto = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const novo = e.target.value;
    onChange(novo);
    verificarAutocomplete(novo, e.target.selectionStart);
  };

  const selecionarSugestao = (nomeCampo: string) => {
    if (posicaoInicioVar === null || !textareaRef.current) return;

    const textoAtual = value;
    const antesVar = textoAtual.slice(0, posicaoInicioVar);
    let depoisCursor = textoAtual.slice(textareaRef.current.selectionStart);

    // Se o usuário abriu com "${", remove eventual "}" duplicado imediatamente à frente do cursor
    if (depoisCursor.startsWith("}")) {
      depoisCursor = depoisCursor.slice(1);
    }

    // Se o nome do campo possuir espaços ou caracteres especiais, encapsula com ${...}
    const tokenInsercao = nomeCampo.includes(" ")
      ? `\${${nomeCampo}} `
      : `$${nomeCampo} `;

    const novoValor = `${antesVar}${tokenInsercao}${depoisCursor}`;
    onChange(novoValor);
    setExibirAutocomplete(false);

    // Reposiciona o cursor após a inserção do campo
    setTimeout(() => {
      if (textareaRef.current) {
        const novaPos = antesVar.length + tokenInsercao.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(novaPos, novaPos);
      }
    }, 10);
  };

  const aoPressionarTecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!exibirAutocomplete || camposFiltrados.length === 0) return;

    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      selecionarSugestao(camposFiltrados[indiceFocoSugestao]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceFocoSugestao((prev) => (prev + 1) % camposFiltrados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceFocoSugestao((prev) =>
        prev === 0 ? camposFiltrados.length - 1 : prev - 1,
      );
    } else if (e.key === "Escape") {
      setExibirAutocomplete(false);
    }
  };

  // Renderiza a query com destaque de sintaxe suportando ${Campo com Espaco} e $Campo
  const renderizarTextoColorido = (texto: string) => {
    if (!texto) return " ";
    const regex =
      /(\$\{[^}\r\n]+\}|\$[a-zA-Z0-9_]+|\b(?:SELECT|FROM|WHERE|AS|AND|OR|JOIN|INNER|LEFT|RIGHT|ON|ORDER|BY|GROUP|HAVING|COUNT|SUM|AVG|MIN|MAX|TOP|DISTINCT|LIKE|IN|IS|NULL|NOT|BETWEEN)\b|'.*?'|\d+)/gi;

    const partes = texto.split(regex);

    return partes.map((parte, index) => {
      if (parte.startsWith("$")) {
        return (
          <span key={index} style={{ color: "#7c3aed", fontWeight: "bold" }}>
            {parte}
          </span>
        );
      }
      if (PALAVRAS_CHAVE_SQL.includes(parte.toUpperCase())) {
        return (
          <span key={index} style={{ color: "#2563eb", fontWeight: "bold" }}>
            {parte}
          </span>
        );
      }
      if (parte.startsWith("'") && parte.endsWith("'")) {
        return (
          <span key={index} style={{ color: "#ca8a04" }}>
            {parte}
          </span>
        );
      }
      if (/^\d+$/.test(parte)) {
        return (
          <span key={index} style={{ color: "#16a34a" }}>
            {parte}
          </span>
        );
      }
      return <span key={index}>{parte}</span>;
    });
  };

  // Fecha o autocomplete ao clicar fora do componente
  useEffect(() => {
    const fechar = () => setExibirAutocomplete(false);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, []);

  const estiloModalContainer: React.CSSProperties = expandido
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        boxSizing: "border-box",
      }
    : {
        position: "relative",
        width: "100%",
      };

  const estiloEditorQuadro: React.CSSProperties = expandido
    ? {
        width: "100%",
        maxWidth: "1000px",
        height: "85vh",
        backgroundColor: "#ffffff",
        borderRadius: "10px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
      }
    : {
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      };

  return (
    <div style={estiloModalContainer}>
      <div style={estiloEditorQuadro} onClick={(e) => e.stopPropagation()}>
        {/* Barra superior com título e botão de expandir/diminuir */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: "#f1f5f9",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          <span
            style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}
          >
            Script SQL
          </span>
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#334155",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {expandido ? "🗗 Diminuir" : "⛶ Expandir"}
          </button>
        </div>

        {/* Área de código com duas camadas sobrepostas */}
        <div
          style={{
            position: "relative",
            flex: expandido ? 1 : "none",
            height: expandido ? "100%" : "150px",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Camada 1: Fundo com as cores do realce de sintaxe */}
          <pre
            ref={preRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: "12px",
              fontFamily: 'Consolas, "Fira Code", monospace',
              fontSize: "0.9rem",
              lineHeight: "1.5",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "hidden",
              pointerEvents: "none",
              color: "#334155",
              boxSizing: "border-box",
            }}
          >
            {renderizarTextoColorido(value)}
          </pre>

          {/* Camada 2: Textarea transparente que recebe a digitação */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={aoMudarTexto}
            onKeyDown={aoPressionarTecla}
            onScroll={aoRolar}
            spellCheck={false}
            placeholder={`Utilize $campo ou \${Nome Campo} para referenciar campos mapeados no documento.\nExemplo:\n\nSELECT Nome AS NomeQuery FROM Contribuintes C WHERE C.CRC = $CRCCampo AND C.Nro = \${Nro Parcelamento}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: "12px",
              fontFamily: 'Consolas, "Fira Code", monospace',
              fontSize: "0.9rem",
              fontStyle: "italic",
              lineHeight: "1.5",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "transparent",
              caretColor: "#0f172a",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          ></textarea>

          {/* Menu Suspenso de Autocomplete */}
          {exibirAutocomplete && camposFiltrados.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "55px",
                left: "24px",
                zIndex: 10,
                backgroundColor: "#ffffff",
                border: "1px solid #c4b5fd",
                borderRadius: "6px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                minWidth: "240px",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  backgroundColor: "#f5f3ff",
                  color: "#6d28d9",
                  borderBottom: "1px solid #ede9fe",
                }}
              >
                Campos do Layout (Tab ou Enter para inserir)
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {camposFiltrados.map((campo, idx) => (
                  <li
                    key={campo}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selecionarSugestao(campo);
                    }}
                    style={{
                      padding: "8px 12px",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      backgroundColor:
                        idx === indiceFocoSugestao ? "#ede9fe" : "#ffffff",
                      color: idx === indiceFocoSugestao ? "#5b21b6" : "#1e293b",
                      fontWeight: idx === indiceFocoSugestao ? 600 : 400,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {campo.includes(" ") ? `\${${campo}}` : `$${campo}`}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      Campo
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
