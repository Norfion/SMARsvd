export function ErroConexaoPage() {
  return (
    <div
      id="pagina-erro-conexao-banco"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--smar-bg-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div id="card-erro-conexao" className="smar-error-card">
        {/* Ícone de alerta de servidor/banco */}
        <div className="smar-error-icon">
          <span>⨉</span>
        </div>

        <h1
          style={{
            fontSize: "1.35rem",
            color: "var(--smar-danger-dark)",
            margin: "0 0 12px 0",
            fontWeight: 700,
          }}
        >
          SISTEMA FORA DO AR
        </h1>

        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--smar-text-label)",
            lineHeight: 1.6,
            margin: "0 0 24px 0",
          }}
        >
          O sistema perdeu a comunicação com o seu serviço de banco de dados ou
          o servidor está temporariamente inacessível.
        </p>

        {/* Bloco de orientações ao usuário */}
        <div className="smar-error-callout">
          <strong
            style={{
              display: "block",
              color: "var(--smar-text-body)",
              fontSize: "0.85rem",
              marginBottom: "6px",
            }}
          >
            O que você pode fazer:
          </strong>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              color: "var(--smar-text-secondary)",
              fontSize: "0.82rem",
              lineHeight: 1.5,
            }}
          >
            <li>Tente recarregar a página para restabelecer a conexão.</li>
            <li>
              Caso o problema persista, contacte a equipe de{" "}
              <strong>Suporte / Desenvolvimento</strong> informando a
              indisponibilidade.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ErroConexaoPage;
