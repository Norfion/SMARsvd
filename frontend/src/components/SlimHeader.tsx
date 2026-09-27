import type { ReactNode } from "react";

export interface CampoSlimHeader {
  titulo: string;
  valor: ReactNode;
}

interface SlimHeaderProps {
  titulo: string;
  campos?: CampoSlimHeader[];
}

// Faixa de identificação da tela, igual ao SlimHeader usado no topo das telas dos sistemas da empresa
export function SlimHeader({ titulo, campos = [] }: SlimHeaderProps) {
  return (
    <span className="slim-header">
      <h5 className="slim-header-titulo">{titulo}</h5>
      <span className="slim-header-conteudo">
        {campos.map((campo) => (
          <div className="slim-header-campo" key={campo.titulo}>
            <label>{campo.titulo}</label>
            <label className="slim-header-valor">{campo.valor}</label>
          </div>
        ))}
      </span>
    </span>
  );
}
