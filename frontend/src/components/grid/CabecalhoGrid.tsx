import { useEffect, useRef, useState } from "react";
import type { CustomHeaderProps } from "ag-grid-react";

const PROXIMA_ACAO_ORDENACAO = {
  asc: "Clique para ordenar de forma decrescente",
  desc: "Clique para cancelar a ordenação",
  nenhuma: "Clique para ordenar de forma crescente",
};

// Cabeçalho de coluna da grid da empresa: título, setas de ordenação e ícone de filtro
export function CabecalhoGrid({
  column,
  displayName,
  enableSorting,
  progressSort,
  showFilter,
}: CustomHeaderProps) {
  const [ordem, setOrdem] = useState(column.getSort());
  const [filtrado, setFiltrado] = useState(column.isFilterActive());
  const botaoFiltroRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const aoOrdenar = () => setOrdem(column.getSort());
    const aoFiltrar = () => setFiltrado(column.isFilterActive());

    column.addEventListener("sortChanged", aoOrdenar);
    column.addEventListener("filterActiveChanged", aoFiltrar);

    return () => {
      column.removeEventListener("sortChanged", aoOrdenar);
      column.removeEventListener("filterActiveChanged", aoFiltrar);
    };
  }, [column]);

  const ordenar = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (enableSorting) progressSort(e.shiftKey);
  };

  const abrirFiltro = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (botaoFiltroRef.current) showFilter(botaoFiltroRef.current);
  };

  return (
    <div
      className={`cabecalho-grid ${enableSorting ? "ordenavel" : ""}`}
      title={
        enableSorting ? PROXIMA_ACAO_ORDENACAO[ordem ?? "nenhuma"] : undefined
      }
      onClick={ordenar}
    >
      <span className="cabecalho-grid-titulo">{displayName}</span>

      {enableSorting && (
        <span className="cabecalho-grid-ordenacao" aria-hidden="true">
          <i
            className={`fas fa-caret-up ${ordem === "asc" ? "ativo" : ""}`}
          ></i>
          <i
            className={`fas fa-caret-down ${ordem === "desc" ? "ativo" : ""}`}
          ></i>
        </span>
      )}

      {column.isFilterAllowed() && (
        <button
          ref={botaoFiltroRef}
          type="button"
          className={`cabecalho-grid-filtro ${filtrado ? "filtrado" : ""}`}
          title="Filtrar"
          aria-label={`Filtrar ${displayName}`}
          onClick={abrirFiltro}
        >
          <i className="fas fa-filter"></i>
        </button>
      )}
    </div>
  );
}
