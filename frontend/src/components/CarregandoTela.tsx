interface CarregandoTelaProps {
  id?: string;
  texto?: string;
}

// Bloqueio de tela com o loader padrão dos sistemas da empresa
export function CarregandoTela({
  id,
  texto = "Carregando . . .",
}: CarregandoTelaProps) {
  return (
    <div id={id} className="loading-screen-blocker">
      <div className="loadingContent">
        <div className="loader"></div>
        <span>{texto}</span>
      </div>
    </div>
  );
}
