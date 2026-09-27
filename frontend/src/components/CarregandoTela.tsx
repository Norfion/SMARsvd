import type { ReactNode } from "react";

interface CarregandoTelaProps {
  id?: string;
  texto?: string;
  children?: ReactNode;
}

// Bloqueio de tela com o loader padrão dos sistemas da empresa
export function CarregandoTela({
  id,
  texto = "Carregando . . .",
  children,
}: CarregandoTelaProps) {
  return (
    <div id={id} className="loading-screen-blocker">
      <div className="loadingContent">
        <div className="loader"></div>
        <span>{texto}</span>
        {children}
      </div>
    </div>
  );
}
