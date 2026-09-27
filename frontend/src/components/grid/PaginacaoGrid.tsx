import { useState } from "react";

interface PaginacaoGridProps {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  totalSelecionados?: number;
  tamanhoPagina: number;
  tamanhosPagina: number[];
  aoMudarPagina: (pagina: number) => void;
  aoMudarTamanho: (tamanho: number) => void;
}

type ItemPaginacao = number | "salto-anterior" | "salto-proximo";

const PAGINAS_POR_SALTO = 5;

function montarItens(atual: number, total: number): ItemPaginacao[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);

  const inicio = Math.max(2, Math.min(atual - 2, total - 4));
  const fim = Math.min(total - 1, Math.max(atual + 2, 5));
  const itens: ItemPaginacao[] = [1];

  if (inicio > 2) itens.push("salto-anterior");
  for (let pagina = inicio; pagina <= fim; pagina++) itens.push(pagina);
  if (fim < total - 1) itens.push("salto-proximo");
  itens.push(total);

  return itens;
}

// Paginação no formato do antd usado pelas listagens da empresa
export function PaginacaoGrid({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  totalSelecionados,
  tamanhoPagina,
  tamanhosPagina,
  aoMudarPagina,
  aoMudarTamanho,
}: PaginacaoGridProps) {
  const [paginaDigitada, setPaginaDigitada] = useState("");
  const atual = paginaAtual + 1;
  const total = Math.max(totalPaginas, 1);

  const irPara = (pagina: number) => {
    const destino = Math.min(Math.max(pagina, 1), total);
    if (destino !== atual) aoMudarPagina(destino - 1);
  };

  const confirmarPaginaDigitada = () => {
    const pagina = Number.parseInt(paginaDigitada, 10);
    if (!Number.isNaN(pagina)) irPara(pagina);
    setPaginaDigitada("");
  };

  return (
    <ul className="paginacao-grid" aria-label="Paginação">
      <li className="paginacao-grid-total">
        {totalSelecionados !== undefined && (
          <div>Selecionados: {totalSelecionados}</div>
        )}
        <div>Total de Registros: {totalRegistros}</div>
      </li>

      <li>
        <button
          type="button"
          className="paginacao-grid-item paginacao-grid-seta"
          title="Página anterior"
          disabled={atual <= 1}
          onClick={() => irPara(atual - 1)}
        >
          <i className="fas fa-chevron-left"></i>
        </button>
      </li>

      {montarItens(atual, total).map((item) =>
        typeof item === "number" ? (
          <li key={item}>
            <button
              type="button"
              className={`paginacao-grid-item ${item === atual ? "ativo" : ""}`}
              aria-current={item === atual ? "page" : undefined}
              onClick={() => irPara(item)}
            >
              {item}
            </button>
          </li>
        ) : (
          <li key={item}>
            <button
              type="button"
              className="paginacao-grid-salto"
              title={
                item === "salto-anterior"
                  ? `${PAGINAS_POR_SALTO} páginas anteriores`
                  : `${PAGINAS_POR_SALTO} próximas páginas`
              }
              onClick={() =>
                irPara(
                  item === "salto-anterior"
                    ? atual - PAGINAS_POR_SALTO
                    : atual + PAGINAS_POR_SALTO,
                )
              }
            >
              <span className="paginacao-grid-reticencias">•••</span>
              <i
                className={`fas ${item === "salto-anterior" ? "fa-angle-double-left" : "fa-angle-double-right"}`}
              ></i>
            </button>
          </li>
        ),
      )}

      <li>
        <button
          type="button"
          className="paginacao-grid-item paginacao-grid-seta"
          title="Próxima página"
          disabled={atual >= total}
          onClick={() => irPara(atual + 1)}
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </li>

      <li className="paginacao-grid-opcoes">
        <select
          className="paginacao-grid-tamanho"
          aria-label="Registros por página"
          value={tamanhoPagina}
          onChange={(e) => aoMudarTamanho(Number(e.target.value))}
        >
          {tamanhosPagina.map((tamanho) => (
            <option key={tamanho} value={tamanho}>
              {tamanho} / página
            </option>
          ))}
        </select>

        <span className="paginacao-grid-ir-para">
          Ir para
          <input
            type="text"
            inputMode="numeric"
            aria-label="Ir para a página"
            value={paginaDigitada}
            onChange={(e) =>
              setPaginaDigitada(e.target.value.replace(/\D/g, ""))
            }
            onKeyDown={(e) => e.key === "Enter" && confirmarPaginaDigitada()}
            onBlur={confirmarPaginaDigitada}
          />
        </span>
      </li>
    </ul>
  );
}
