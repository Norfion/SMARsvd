export function ErroConexaoPage() {
  return (
    <div
      id="pagina-erro-conexao-banco"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f0f2f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        id="card-erro-conexao"
        style={{
          maxWidth: "580px",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #cfd8dc",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        {/* Ícone de alerta de servidor/banco */}
        <div
          style={{
            width: "68px",
            height: "68px",
            margin: "0 auto 20px auto",
            backgroundColor: "#ffebee",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#c62828",
            fontSize: "2rem",
            border: "1px solid #ffcdd2",
          }}
        >
          <span>⨉</span>
        </div>

        <h1
          style={{
            fontSize: "1.35rem",
            color: "#b71c1c",
            margin: "0 0 12px 0",
            fontWeight: 700,
          }}
        >
          SISTEMA FORA DO AR{" "}
        </h1>

        <p
          style={{
            fontSize: "0.92rem",
            color: "#455a64",
            lineHeight: 1.6,
            margin: "0 0 24px 0",
          }}
        >
          O sistema perdeu a comunicação com os serviços de banco de dados ou o
          servidor está temporariamente inacessível.
        </p>

        {/* Bloco de orientações ao usuário */}
        <div
          style={{
            backgroundColor: "#fafafa",
            borderLeft: "4px solid #c62828",
            borderTop: "1px solid #eeeeee",
            borderRight: "1px solid #eeeeee",
            borderBottom: "1px solid #eeeeee",
            padding: "14px 16px",
            textAlign: "left",
            marginBottom: "28px",
            borderRadius: "0 4px 4px 0",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#37474f",
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
              color: "#546e7a",
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
