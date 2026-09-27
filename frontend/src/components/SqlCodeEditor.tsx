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
          <span key={index} className="sql-variavel">
            {parte}
          </span>
        );
      }
      if (PALAVRAS_CHAVE_SQL.includes(parte.toUpperCase())) {
        return (
          <span key={index} className="sql-palavra-chave">
            {parte}
          </span>
        );
      }
      if (parte.startsWith("'") && parte.endsWith("'")) {
        return (
          <span key={index} className="sql-texto">
            {parte}
          </span>
        );
      }
      if (/^\d+$/.test(parte)) {
        return (
          <span key={index} className="sql-numero">
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

  return (
    <div
      className={expandido ? "editor-sql-expandido" : "editor-sql-container"}
    >
      <div className="editor-sql" onClick={(e) => e.stopPropagation()}>
        <div className="editor-sql-barra">
          <span className="editor-sql-titulo">Script SQL</span>
          <button
            type="button"
            className="btn btn-cancel btn-xxs"
            onClick={() => setExpandido(!expandido)}
          >
            <i
              className={
                expandido ? "fas fa-compress-alt" : "fas fa-expand-alt"
              }
            ></i>{" "}
            {expandido ? "Diminuir" : "Expandir"}
          </button>
        </div>

        {/* Duas camadas sobrepostas: o realce de sintaxe fica atrás do textarea transparente */}
        <div className="editor-sql-area">
          <pre ref={preRef} aria-hidden="true" className="editor-sql-realce">
            {renderizarTextoColorido(value)}
          </pre>

          <textarea
            ref={textareaRef}
            className="editor-sql-entrada"
            value={value}
            onChange={aoMudarTexto}
            onKeyDown={aoPressionarTecla}
            onScroll={aoRolar}
            spellCheck={false}
            placeholder={`Utilize $campo ou \${Nome Campo} para referenciar campos mapeados no documento.\nExemplo:\n\nSELECT Nome AS NomeQuery FROM Contribuintes C WHERE C.CRC = $CRCCampo AND C.Nro = \${Nro Parcelamento}`}
          ></textarea>

          {exibirAutocomplete && camposFiltrados.length > 0 && (
            <div className="editor-sql-sugestoes">
              <div className="editor-sql-sugestoes-titulo">
                Campos do Layout (Tab ou Enter para inserir)
              </div>
              <ul>
                {camposFiltrados.map((campo, idx) => (
                  <li
                    key={campo}
                    className={idx === indiceFocoSugestao ? "ativo" : ""}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selecionarSugestao(campo);
                    }}
                  >
                    <span>
                      {campo.includes(" ") ? `\${${campo}}` : `$${campo}`}
                    </span>
                    <small>Campo</small>
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
