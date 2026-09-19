export type TipoModalInformativo = "sucesso" | "aviso" | "erro" | "confirmacao";

interface ModalInformativoProps {
  aberto: boolean;
  tipo: TipoModalInformativo;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  exigeSenha?: boolean;
  valorSenha?: string;
  aoMudarSenha?: (novaSenha: string) => void;
  aoFechar: () => void;
  aoConfirmar?: (senha?: string) => void;
}

export function ModalInformativo({
  aberto,
  tipo,
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  exigeSenha = false,
  valorSenha = "",
  aoMudarSenha,
  aoFechar,
  aoConfirmar,
}: ModalInformativoProps) {
  if (!aberto) return null;

  const configuracoes = {
    sucesso: {
      corDestaque: "#00796b",
      corFundoIcone: "#e0f2f1",
      borda: "#b2dfdb",
      icone: "✓",
    },
    aviso: {
      corDestaque: "#f57c00",
      corFundoIcone: "#fff3e0",
      borda: "#ffe0b2",
      icone: "!",
    },
    erro: {
      corDestaque: "#c62828",
      corFundoIcone: "#ffebee",
      borda: "#ffcdd2",
      icone: "✕",
    },
    confirmacao: {
      corDestaque: "#c62828",
      corFundoIcone: "#ffebee",
      borda: "#ffcdd2",
      icone: "?",
    },
  }[tipo];

  const ehConfirmacao = tipo === "confirmacao";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(1px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "4px",
          border: "1px solid #cfd8dc",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          width: "90%",
          maxWidth: "440px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            backgroundColor: configuracoes.corFundoIcone,
            borderBottom: `1px solid ${configuracoes.borda}`,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: configuracoes.corDestaque,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.85rem",
              fontWeight: 800,
            }}
          >
            <span>{configuracoes.icone}</span>
          </div>
          <strong
            style={{
              color: configuracoes.corDestaque,
              fontSize: "0.95rem",
            }}
          >
            {titulo}
          </strong>
        </div>

        {/* Corpo */}
        <div
          style={{
            padding: "18px 16px",
            color: "#37474f",
            fontSize: "0.85rem",
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          <p style={{ margin: "0 0 10px 0" }}>{mensagem}</p>

          {exigeSenha && (
            <div style={{ marginTop: "12px" }}>
              <label
                htmlFor="input-senha-modal"
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  color: "#455a64",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                Senha de confirmação:
              </label>
              <input
                id="input-senha-modal"
                type="password"
                value={valorSenha}
                onChange={(e) => aoMudarSenha && aoMudarSenha(e.target.value)}
                placeholder="Digite a senha de segurança..."
                autoFocus
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #cfd8dc",
                  height: "34px",
                  boxSizing: "border-box",
                }}
              ></input>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div
          style={{
            padding: "10px 16px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #eceff1",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          {ehConfirmacao ? (
            <>
              <button
                type="button"
                onClick={aoFechar}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#546e7a",
                  border: "1px solid #cfd8dc",
                  padding: "6px 14px",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                <span>{textoCancelar}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  aoFechar();
                  if (aoConfirmar) aoConfirmar(valorSenha);
                }}
                style={{
                  backgroundColor: configuracoes.corDestaque,
                  color: "#ffffff",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "4px",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                }}
              >
                <span>{textoConfirmar}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={aoFechar}
              style={{
                backgroundColor: configuracoes.corDestaque,
                color: "#ffffff",
                border: "none",
                padding: "6px 18px",
                borderRadius: "4px",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <span>Entendi</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
