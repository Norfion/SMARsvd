import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Column, GridApi, SortDirection } from "ag-grid-community";
import Swal from "sweetalert2";
import { CaixaSelecaoGrid } from "./CaixaSelecaoGrid";
import { COLUNA_SELECAO, descreverFiltro } from "./utilitariosGrid";

export interface ItemImpressaoGrid {
  titulo: string;
  icone: string;
  aoClicar: () => void;
}

interface MenuAcaoGridProps {
  icone: string;
  dica: string;
  children: (fechar: () => void) => ReactNode;
}

function useFecharAoClicarFora(aberto: boolean, fechar: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const aoClicar = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) fechar();
    };
    const aoPressionarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoPressionarTecla);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoPressionarTecla);
    };
  }, [aberto, fechar]);

  return containerRef;
}

function MenuAcaoGrid({ icone, dica, children }: MenuAcaoGridProps) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  const containerRef = useFecharAoClicarFora(aberto, fechar);

  return (
    <div ref={containerRef} className="menu-acao-grid">
      <button
        type="button"
        className="btn-custom"
        data-dica={aberto ? undefined : dica}
        aria-label={dica}
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
      >
        <i className={icone}></i>
      </button>
      {aberto && <div className="painel-suspenso-grid">{children(fechar)}</div>}
    </div>
  );
}

function CabecalhoPainelSuspenso({
  titulo,
  aoRestaurar,
}: {
  titulo: string;
  aoRestaurar?: () => void;
}) {
  return (
    <div className="painel-suspenso-grid-cabecalho">
      <h5>{titulo}</h5>
      {aoRestaurar && (
        <button
          type="button"
          className="link-grid"
          title="Restaurar"
          aria-label="Restaurar"
          onClick={aoRestaurar}
        >
          <i className="fas fa-redo"></i>
        </button>
      )}
    </div>
  );
}

function MenuImpressaoGrid({ itens }: { itens: ItemImpressaoGrid[] }) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  const containerRef = useFecharAoClicarFora(aberto, fechar);

  return (
    <div ref={containerRef} className="dropdown">
      <button
        type="button"
        className="btn btn-primary btn-custom dropdown-toggle"
        data-dica={aberto ? undefined : "Imprimir Resultado"}
        aria-label="Imprimir Resultado"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
      >
        <i className="fas fa-print"></i>
      </button>
      {aberto && (
        <div className="dropdown-menu dropdown-menu-right show" role="menu">
          {itens.map((item) => (
            <button
              key={item.titulo}
              type="button"
              role="menuitem"
              className="dropdown-item"
              onClick={() => {
                fechar();
                item.aoClicar();
              }}
            >
              <i className={item.icone}></i>
              {item.titulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function nomeColuna(api: GridApi, colId: string): string {
  return api.getColumn(colId)?.getColDef().headerName ?? colId;
}

function colunasConfiguraveis(api: GridApi): Column[] {
  return (api.getAllGridColumns() ?? []).filter(
    (coluna) => coluna.getColId() !== COLUNA_SELECAO,
  );
}

interface BarraAcoesGridProps {
  api: GridApi;
  itensImpressao?: ItemImpressaoGrid[];
}

// Barra de ações das listagens da empresa (Common/components/table/components/table.toolbar)
export function BarraAcoesGrid({ api, itensImpressao }: BarraAcoesGridProps) {
  const filtros = Object.entries(api.getFilterModel() ?? {});
  const ordenacoes = api
    .getColumnState()
    .filter((estado) => estado.sort)
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const colunas = colunasConfiguraveis(api);

  const removerFiltro = (colId: string) => {
    api.setColumnFilterModel(colId, null).then(() => api.onFilterChanged());
  };

  const ordenar = (colId: string, sort: SortDirection) => {
    api.applyColumnState({ state: [{ colId, sort }] });
  };

  const restaurarOrdenacao = () => {
    const padrao = (api.getColumns() ?? [])
      .filter((coluna) => coluna.getColDef().sort)
      .map((coluna) => ({
        colId: coluna.getColId(),
        sort: coluna.getColDef().sort ?? null,
      }));
    api.applyColumnState({ state: padrao, defaultState: { sort: null } });
  };

  const alterarVisibilidade = (coluna: Column, visivel: boolean) => {
    const visiveis = colunas.filter((item) => item.isVisible());
    if (!visivel && visiveis.length === 1) {
      Swal.fire({
        type: "warning",
        title: "Atenção",
        text: "Ao menos uma coluna deve permanecer visível.",
      });
      return;
    }
    api.setColumnsVisible([coluna], visivel);
  };

  const restaurarColunas = () => {
    api.applyColumnState({
      state: (api.getColumns() ?? []).map((coluna) => ({
        colId: coluna.getColId(),
        hide: coluna.getColDef().hide ?? false,
      })),
      applyOrder: true,
    });
  };

  return (
    <div className="action-bar clearfix">
      <div className="float-right">
        <MenuAcaoGrid icone="fas fa-filter" dica="Ver Filtro">
          {() => (
            <>
              <CabecalhoPainelSuspenso titulo="Filtros" />
              <ul className="lista-suspensa-grid">
                {filtros.length === 0 && (
                  <li className="lista-suspensa-grid-vazia">
                    Nenhum filtro aplicado.
                  </li>
                )}
                {filtros.map(([colId, modelo]) => (
                  <li key={colId}>
                    <div className="lista-suspensa-grid-texto">
                      <strong>{nomeColuna(api, colId)}</strong>
                      {descreverFiltro(modelo).map((descricao) => (
                        <span key={descricao}>{descricao}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="link-grid"
                      title="Remover filtro"
                      aria-label={`Remover filtro de ${nomeColuna(api, colId)}`}
                      onClick={() => removerFiltro(colId)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </MenuAcaoGrid>

        {itensImpressao && itensImpressao.length > 0 && (
          <MenuImpressaoGrid itens={itensImpressao} />
        )}

        <button
          type="button"
          className="btn-custom"
          data-dica="Limpar Filtros"
          aria-label="Limpar Filtros"
          onClick={() => api.setFilterModel(null)}
        >
          <i className="fas fa-eraser"></i>
        </button>

        <MenuAcaoGrid icone="fas fa-sort-amount-up-alt" dica="Ordenação">
          {() => (
            <>
              <CabecalhoPainelSuspenso
                titulo="Ordenação"
                aoRestaurar={restaurarOrdenacao}
              />
              <ul className="lista-suspensa-grid">
                {ordenacoes.length === 0 && (
                  <li className="lista-suspensa-grid-vazia">
                    Nenhuma ordenação aplicada.
                  </li>
                )}
                {ordenacoes.map((estado) => (
                  <li key={estado.colId}>
                    <span className="lista-suspensa-grid-texto">
                      {nomeColuna(api, estado.colId)}
                    </span>
                    <button
                      type="button"
                      className="link-grid"
                      title={
                        estado.sort === "asc"
                          ? "Ordem crescente"
                          : "Ordem decrescente"
                      }
                      onClick={() =>
                        ordenar(
                          estado.colId,
                          estado.sort === "asc" ? "desc" : "asc",
                        )
                      }
                    >
                      <i
                        className={`fas ${estado.sort === "asc" ? "fa-caret-up" : "fa-caret-down"}`}
                      ></i>
                    </button>
                    <button
                      type="button"
                      className="link-grid"
                      title="Remover ordenação"
                      onClick={() => ordenar(estado.colId, null)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </MenuAcaoGrid>

        <MenuAcaoGrid icone="fas fa-eye" dica="Configuração Colunas">
          {() => (
            <>
              <CabecalhoPainelSuspenso
                titulo="Colunas"
                aoRestaurar={restaurarColunas}
              />
              <ul className="lista-suspensa-grid">
                {colunas.map((coluna) => (
                  <li key={coluna.getColId()}>
                    <CaixaSelecaoGrid
                      rotulo={coluna.getColDef().headerName}
                      marcado={coluna.isVisible()}
                      aoAlterar={(visivel) =>
                        alterarVisibilidade(coluna, visivel)
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </MenuAcaoGrid>
      </div>
    </div>
  );
}
