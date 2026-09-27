import { useCallback, useRef, useState } from "react";
import { useGridFilter, type CustomFilterProps } from "ag-grid-react";
import type {
  IAfterGuiAttachedParams,
  IDoesFilterPassParams,
} from "ag-grid-community";
import { CaixaSelecaoGrid } from "./CaixaSelecaoGrid";

export interface ModeloFiltroTexto {
  contem?: string;
  comecaCom?: string;
  naoCoincidentes?: boolean;
  somenteVazio?: boolean;
}

export interface ModeloFiltroLista {
  valores: string[];
}

export interface OpcaoFiltroLista {
  valor: string;
  rotulo: string;
}

const VALORES_VAZIOS = ["", "—"];

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function useFechamentoDoFiltro() {
  const fecharRef = useRef<(() => void) | undefined>(undefined);
  const campoInicialRef = useRef<HTMLInputElement>(null);

  const afterGuiAttached = useCallback((params?: IAfterGuiAttachedParams) => {
    fecharRef.current = params?.hidePopup;
    window.setTimeout(() => campoInicialRef.current?.focus());
  }, []);

  const fechar = useCallback(() => fecharRef.current?.(), []);

  return { afterGuiAttached, fechar, campoInicialRef };
}

// Filtro de texto da grid da empresa (Common/components/table/components/filters/table.filter.text)
export function FiltroTextoGrid({
  model,
  onModelChange,
  getValue,
  colDef,
}: CustomFilterProps<unknown, unknown, ModeloFiltroTexto>) {
  const [rascunho, setRascunho] = useState<ModeloFiltroTexto>(model ?? {});
  const [modeloAnterior, setModeloAnterior] = useState(model);
  const { afterGuiAttached, fechar, campoInicialRef } = useFechamentoDoFiltro();

  if (model !== modeloAnterior) {
    setModeloAnterior(model);
    setRascunho(model ?? {});
  }

  const doesFilterPass = useCallback(
    ({ node }: IDoesFilterPassParams) => {
      if (!model) return true;

      const valor = normalizar(getValue(node));

      if (model.somenteVazio) return VALORES_VAZIOS.includes(valor);

      const contem = normalizar(model.contem);
      const comecaCom = normalizar(model.comecaCom);
      const coincide =
        (!contem || valor.includes(contem)) &&
        (!comecaCom || valor.startsWith(comecaCom));

      return model.naoCoincidentes ? !coincide : coincide;
    },
    [model, getValue],
  );

  useGridFilter({ doesFilterPass, afterGuiAttached });

  const podeAplicar =
    !!rascunho.somenteVazio || !!rascunho.contem || !!rascunho.comecaCom;

  const aplicar = () => {
    if (!podeAplicar) return;
    onModelChange({ ...rascunho });
    fechar();
  };

  const limpar = () => {
    setRascunho({});
    onModelChange(null);
    fechar();
  };

  const aoPressionarTecla = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") aplicar();
  };

  return (
    <div className="filtro-grid">
      <h2 className="filtro-grid-titulo">{colDef.headerName}</h2>

      <span className="filtro-grid-rotulo">Contém:</span>
      <input
        ref={campoInicialRef}
        type="text"
        className="filtro-grid-campo"
        value={rascunho.contem ?? ""}
        disabled={rascunho.somenteVazio}
        onChange={(e) => setRascunho({ ...rascunho, contem: e.target.value })}
        onKeyDown={aoPressionarTecla}
      />

      <span className="filtro-grid-rotulo">Começa com:</span>
      <input
        type="text"
        className="filtro-grid-campo"
        value={rascunho.comecaCom ?? ""}
        disabled={rascunho.somenteVazio}
        onChange={(e) =>
          setRascunho({ ...rascunho, comecaCom: e.target.value })
        }
        onKeyDown={aoPressionarTecla}
      />

      <CaixaSelecaoGrid
        rotulo="Registros não coincidentes"
        marcado={!!rascunho.naoCoincidentes}
        aoAlterar={(marcado) =>
          setRascunho({
            ...rascunho,
            naoCoincidentes: marcado,
            somenteVazio: marcado ? false : rascunho.somenteVazio,
          })
        }
      />
      <CaixaSelecaoGrid
        rotulo="Somente Vazio"
        marcado={!!rascunho.somenteVazio}
        aoAlterar={(marcado) =>
          setRascunho({
            ...rascunho,
            somenteVazio: marcado,
            naoCoincidentes: marcado ? false : rascunho.naoCoincidentes,
          })
        }
      />

      <div className="filtro-grid-botoes">
        <button
          type="button"
          className="botao-grid botao-grid-cancelar"
          onClick={limpar}
        >
          Limpar
        </button>
        <button
          type="button"
          className="botao-grid botao-grid-primario"
          disabled={!podeAplicar}
          onClick={aplicar}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

// Filtro de lista da grid da empresa (Common/components/table/components/filters/table.filter.lista)
export function FiltroListaGrid({
  model,
  onModelChange,
  getValue,
  colDef,
  opcoes,
}: CustomFilterProps<unknown, unknown, ModeloFiltroLista> & {
  opcoes: OpcaoFiltroLista[];
}) {
  const todosValores = opcoes.map((opcao) => opcao.valor);
  const [marcados, setMarcados] = useState<string[]>(
    model?.valores ?? todosValores,
  );
  const [modeloAnterior, setModeloAnterior] = useState(model);
  const { afterGuiAttached, fechar } = useFechamentoDoFiltro();

  if (model !== modeloAnterior) {
    setModeloAnterior(model);
    setMarcados(model?.valores ?? todosValores);
  }

  const doesFilterPass = useCallback(
    ({ node }: IDoesFilterPassParams) =>
      !model || model.valores.includes(String(getValue(node) ?? "")),
    [model, getValue],
  );

  useGridFilter({ doesFilterPass, afterGuiAttached });

  const todosMarcados = marcados.length === todosValores.length;

  const alternar = (valor: string, marcado: boolean) => {
    setMarcados((atuais) =>
      marcado ? [...atuais, valor] : atuais.filter((item) => item !== valor),
    );
  };

  const aplicar = () => {
    if (marcados.length === 0) return;
    onModelChange(todosMarcados ? null : { valores: marcados });
    fechar();
  };

  const limpar = () => {
    setMarcados(todosValores);
    onModelChange(null);
    fechar();
  };

  return (
    <div className="filtro-grid">
      <h2 className="filtro-grid-titulo">{colDef.headerName}</h2>

      <div className="filtro-grid-lista">
        <CaixaSelecaoGrid
          rotulo="Selecionar Todos"
          marcado={todosMarcados}
          indeterminado={marcados.length > 0}
          aoAlterar={(marcado) => setMarcados(marcado ? todosValores : [])}
        />
        {opcoes.map((opcao) => (
          <CaixaSelecaoGrid
            key={opcao.valor}
            rotulo={opcao.rotulo}
            marcado={marcados.includes(opcao.valor)}
            aoAlterar={(marcado) => alternar(opcao.valor, marcado)}
          />
        ))}
      </div>

      <div className="filtro-grid-botoes filtro-grid-botoes-cheios">
        <button
          type="button"
          className="botao-grid botao-grid-cancelar"
          onClick={limpar}
        >
          Limpar
        </button>
        <button
          type="button"
          className="botao-grid botao-grid-primario"
          disabled={marcados.length === 0}
          onClick={aplicar}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
