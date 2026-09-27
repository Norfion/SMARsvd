import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GridApi, IRowNode } from "ag-grid-community";
import type { CustomCellRendererProps, CustomHeaderProps } from "ag-grid-react";
import { CaixaSelecaoGrid } from "./CaixaSelecaoGrid";

function nosDaPaginaAtual(api: GridApi): IRowNode[] {
  const tamanho = api.paginationGetPageSize();
  const inicio = api.paginationGetCurrentPage() * tamanho;
  const fim = Math.min(inicio + tamanho, api.getDisplayedRowCount());
  const nos: IRowNode[] = [];

  for (let indice = inicio; indice < fim; indice++) {
    const no = api.getDisplayedRowAtIndex(indice);
    if (no) nos.push(no);
  }

  return nos;
}

export function CelulaSelecaoGrid({ node }: CustomCellRendererProps) {
  const [selecionado, setSelecionado] = useState(!!node.isSelected());

  useEffect(() => {
    const aoSelecionar = () => setSelecionado(!!node.isSelected());
    node.addEventListener("rowSelected", aoSelecionar);
    return () => node.removeEventListener("rowSelected", aoSelecionar);
  }, [node]);

  return (
    <CaixaSelecaoGrid
      titulo="Selecionar registro"
      marcado={selecionado}
      aoAlterar={(marcado) => node.setSelected(marcado)}
    />
  );
}

type EstadoSelecaoPagina = "todos" | "alguns" | "nenhum";

// Cabeçalho da coluna de seleção: marca a página atual e oferece o menu de seleções da empresa
export function CabecalhoSelecaoGrid({ api }: CustomHeaderProps) {
  const [estado, setEstado] = useState<EstadoSelecaoPagina>("nenhum");
  const [menuAberto, setMenuAberto] = useState(false);
  const [posicaoMenu, setPosicaoMenu] = useState({ top: 0, left: 0 });
  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const atualizar = () => {
      const nos = nosDaPaginaAtual(api);
      const selecionados = nos.filter((no) => no.isSelected()).length;

      if (nos.length > 0 && selecionados === nos.length) setEstado("todos");
      else if (selecionados > 0) setEstado("alguns");
      else setEstado("nenhum");
    };

    const eventos = [
      "selectionChanged",
      "paginationChanged",
      "modelUpdated",
    ] as const;

    atualizar();
    eventos.forEach((evento) => api.addEventListener(evento, atualizar));
    return () =>
      eventos.forEach((evento) => api.removeEventListener(evento, atualizar));
  }, [api]);

  useLayoutEffect(() => {
    if (!menuAberto || !botaoMenuRef.current) return;
    const retangulo = botaoMenuRef.current.getBoundingClientRect();
    setPosicaoMenu({ top: retangulo.bottom + 4, left: retangulo.left - 8 });
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) return;

    const fecharAoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (
        !menuRef.current?.contains(alvo) &&
        !botaoMenuRef.current?.contains(alvo)
      ) {
        setMenuAberto(false);
      }
    };
    const fechar = () => setMenuAberto(false);

    document.addEventListener("mousedown", fecharAoClicarFora);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [menuAberto]);

  const selecionarPagina = (selecionar: boolean) => {
    api.setNodesSelected({
      nodes: nosDaPaginaAtual(api),
      newValue: selecionar,
    });
  };

  const opcoes = [
    { titulo: "Marcar Página", acao: () => selecionarPagina(true) },
    { titulo: "Desmarcar Página", acao: () => selecionarPagina(false) },
    { titulo: "Marcar Filtrados", acao: () => api.selectAll("filtered") },
    { titulo: "Desmarcar Todos", acao: () => api.deselectAll() },
  ];

  return (
    <div className="cabecalho-selecao-grid">
      <CaixaSelecaoGrid
        titulo="Selecionar página"
        marcado={estado === "todos"}
        indeterminado={estado === "alguns"}
        aoAlterar={(marcado) => selecionarPagina(marcado)}
      />
      <button
        ref={botaoMenuRef}
        type="button"
        className="cabecalho-selecao-grid-menu"
        title="Opções de seleção"
        aria-haspopup="menu"
        aria-expanded={menuAberto}
        onClick={() => setMenuAberto((aberto) => !aberto)}
      >
        <i className="fas fa-chevron-down"></i>
      </button>

      {menuAberto &&
        createPortal(
          <ul
            ref={menuRef}
            className="menu-suspenso-grid"
            role="menu"
            style={posicaoMenu}
          >
            {opcoes.map((opcao) => (
              <li key={opcao.titulo} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    opcao.acao();
                    setMenuAberto(false);
                  }}
                >
                  {opcao.titulo}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
