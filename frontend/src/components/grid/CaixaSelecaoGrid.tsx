interface CaixaSelecaoGridProps {
  marcado: boolean;
  aoAlterar: (marcado: boolean) => void;
  indeterminado?: boolean;
  desabilitado?: boolean;
  rotulo?: string;
  titulo?: string;
}

// Checkbox no formato do antd usado pela grid da empresa
export function CaixaSelecaoGrid({
  marcado,
  aoAlterar,
  indeterminado = false,
  desabilitado = false,
  rotulo,
  titulo,
}: CaixaSelecaoGridProps) {
  const estado = marcado ? "marcada" : indeterminado ? "indeterminada" : "";

  return (
    <label
      className={`caixa-selecao-grid ${desabilitado ? "desabilitada" : ""}`}
      title={titulo}
    >
      <span className={`caixa-selecao-grid-caixa ${estado}`}>
        <input
          type="checkbox"
          checked={marcado}
          disabled={desabilitado}
          aria-label={rotulo ? undefined : titulo}
          ref={(elemento) => {
            if (elemento) elemento.indeterminate = indeterminado && !marcado;
          }}
          onChange={(e) => aoAlterar(e.target.checked)}
        />
        <span className="caixa-selecao-grid-marca"></span>
      </span>
      {rotulo && <span className="caixa-selecao-grid-rotulo">{rotulo}</span>}
    </label>
  );
}
