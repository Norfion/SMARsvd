import type { ReactNode } from "react";

interface PainelProps {
  id?: string;
  titulo: ReactNode;
  /** Texto exibido à direita do título (ex.: modelo carregado) */
  resumo?: ReactNode;
  /** Quando informado, o cabeçalho passa a recolher/expandir o conteúdo */
  aoAlternar?: () => void;
  aberto?: boolean;
  /** Exibe o painel esmaecido, indicando que a etapa ainda não está disponível */
  desabilitado?: boolean;
  className?: string;
  children?: ReactNode;
}

// Painel no padrão do Common (fieldset > .card.panel.panel-default > .panel-heading + .card-body).
// Quando recolhido, o conteúdo é apenas ocultado para não perder o estado interno dos campos.
export function Painel({
  id,
  titulo,
  resumo,
  aoAlternar,
  aberto = true,
  desabilitado = false,
  className = "",
  children,
}: PainelProps) {
  const recolhivel = aoAlternar !== undefined;

  return (
    <fieldset id={id}>
      <div
        className={`card panel panel-default ${aberto ? "" : "painel-fechado"} ${desabilitado ? "painel-desabilitado" : ""} ${className}`}
      >
        <div
          className={`card-header panel-heading ${recolhivel ? "painel-recolhivel" : ""}`}
          onClick={aoAlternar}
          role={recolhivel ? "button" : undefined}
          aria-expanded={recolhivel ? aberto : undefined}
        >
          <h3 className="panel-title">{titulo}</h3>
          {resumo && <span className="painel-resumo">{resumo}</span>}
          {recolhivel && (
            <i
              className={`painel-icone fas ${aberto ? "fa-chevron-up" : "fa-chevron-down"}`}
            ></i>
          )}
        </div>
        <div className={`card-body ${aberto ? "" : "d-none"}`}>{children}</div>
      </div>
    </fieldset>
  );
}
