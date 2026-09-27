import { useMemo, useReducer, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridState,
} from "ag-grid-community";
import { BarraAcoesGrid, type ItemImpressaoGrid } from "./BarraAcoesGrid";
import { CabecalhoGrid } from "./CabecalhoGrid";
import { FiltroTextoGrid } from "./FiltrosGrid";
import { PaginacaoGrid } from "./PaginacaoGrid";
import { CabecalhoSelecaoGrid, CelulaSelecaoGrid } from "./SelecaoGrid";
import { TooltipGrid } from "./TooltipGrid";
import { COLUNA_SELECAO } from "./utilitariosGrid";

ModuleRegistry.registerModules([AllCommunityModule]);

// Medidas e cores da Table do antd (size="small", bordered) com os overrides da empresa
const TEMA_GRID = themeQuartz.withParams({
  accentColor: "#0cae89",
  fontFamily: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
  fontSize: 13,
  dataFontSize: 13,
  headerFontSize: 13,
  foregroundColor: "#333333",
  textColor: "#333333",
  backgroundColor: "#ffffff",
  borderColor: "#f0f0f0",
  borderRadius: 2,
  wrapperBorderRadius: 2,
  wrapperBorder: { color: "#f0f0f0" },
  headerHeight: 39,
  rowHeight: 39,
  cellHorizontalPadding: 8,
  headerBackgroundColor: "#0cae89",
  headerTextColor: "#fafafa",
  headerFontWeight: 500,
  headerCellHoverBackgroundColor: "#0cae89",
  headerCellMovingBackgroundColor: "#0a9676",
  headerColumnBorder: { color: "#f0f0f0" },
  headerColumnBorderHeight: "100%",
  headerRowBorder: { color: "rgba(255, 255, 255, 0.25)" },
  headerColumnResizeHandleColor: "transparent",
  columnBorder: { color: "#f0f0f0" },
  rowBorder: { color: "#f0f0f0" },
  pinnedColumnBorder: { color: "#f0f0f0" },
  oddRowBackgroundColor: "#ffffff",
  rowHoverColor: "#c3c3c3",
  selectedRowBackgroundColor: "#e6f7ff",
  tooltipBackgroundColor: "#224b42",
  tooltipTextColor: "#ffffff",
  tooltipBorder: false,
  menuBorder: false,
  popupShadow:
    "0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
  iconSize: 12,
});

const COLUNA_SELECAO_DEF: ColDef = {
  colId: COLUNA_SELECAO,
  headerComponent: CabecalhoSelecaoGrid,
  cellRenderer: CelulaSelecaoGrid,
  headerClass: "cabecalho-coluna-selecao",
  cellClass: "celula-coluna-selecao",
  width: 60,
  minWidth: 60,
  maxWidth: 60,
  pinned: "left",
  lockPinned: true,
  lockPosition: "left",
  suppressMovable: true,
  resizable: false,
  sortable: false,
  filter: false,
  tooltipValueGetter: () => null,
};

const COLUNA_PADRAO: ColDef = {
  headerComponent: CabecalhoGrid,
  filter: FiltroTextoGrid,
  sortable: true,
  resizable: true,
  minWidth: 80,
  suppressHeaderMenuButton: true,
  suppressHeaderFilterButton: true,
  tooltipComponent: TooltipGrid,
  tooltipValueGetter: (params) => params.valueFormatted ?? params.value,
};

interface GridPadraoProps<T> {
  id?: string;
  linhas: T[];
  colunas: ColDef<T>[];
  estadoInicial?: GridState;
  itensImpressao?: ItemImpressaoGrid[];
  tamanhoPagina?: number;
  tamanhosPagina?: number[];
  alturaCorpo?: number;
  selecionavel?: boolean;
}

// Grid no padrão visual das listagens dos sistemas da empresa (Common/components/table)
export function GridPadrao<T>({
  id,
  linhas,
  colunas,
  estadoInicial,
  itensImpressao,
  tamanhoPagina = 20,
  tamanhosPagina = [10, 20, 50, 100],
  alturaCorpo = 500,
  selecionavel = false,
}: GridPadraoProps<T>) {
  const [api, setApi] = useState<GridApi<T> | null>(null);
  const [, atualizar] = useReducer((versao: number) => versao + 1, 0);

  const definicoesColunas = useMemo<ColDef<T>[]>(
    () =>
      selecionavel ? [COLUNA_SELECAO_DEF as ColDef<T>, ...colunas] : colunas,
    [colunas, selecionavel],
  );

  return (
    <div id={id} className="tabela-grid">
      {api && (
        <BarraAcoesGrid api={api as GridApi} itensImpressao={itensImpressao} />
      )}

      <div className="tabela-grid-corpo" style={{ height: alturaCorpo + 41 }}>
        <AgGridReact<T>
          theme={TEMA_GRID}
          rowData={linhas}
          columnDefs={definicoesColunas}
          defaultColDef={COLUNA_PADRAO as ColDef<T>}
          initialState={estadoInicial}
          pagination={true}
          paginationPageSize={tamanhoPagina}
          suppressPaginationPanel={true}
          rowSelection={
            selecionavel
              ? {
                  mode: "multiRow",
                  checkboxes: false,
                  headerCheckbox: false,
                  enableClickSelection: false,
                }
              : undefined
          }
          enableCellTextSelection={true}
          ensureDomOrder={true}
          suppressCellFocus={true}
          alwaysShowVerticalScroll={true}
          tooltipShowDelay={300}
          tooltipHideDelay={10000}
          overlayNoRowsTemplate='<span class="tabela-grid-vazia">Nenhum registro encontrado.</span>'
          onGridReady={(evento) => setApi(evento.api)}
          onFilterChanged={atualizar}
          onSortChanged={atualizar}
          onPaginationChanged={atualizar}
          onSelectionChanged={atualizar}
          onDisplayedColumnsChanged={atualizar}
          onRowDataUpdated={atualizar}
        />
      </div>

      {api && (
        <PaginacaoGrid
          paginaAtual={api.paginationGetCurrentPage()}
          totalPaginas={api.paginationGetTotalPages()}
          totalRegistros={api.getDisplayedRowCount()}
          totalSelecionados={
            selecionavel ? api.getSelectedRows().length : undefined
          }
          tamanhoPagina={api.paginationGetPageSize()}
          tamanhosPagina={tamanhosPagina}
          aoMudarPagina={(pagina) => api.paginationGoToPage(pagina)}
          aoMudarTamanho={(tamanho) =>
            api.setGridOption("paginationPageSize", tamanho)
          }
        />
      )}
    </div>
  );
}
