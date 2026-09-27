import axios from "axios";
import { useState, type FormEvent } from "react";
import { sessaoService } from "../services/sessaoService";

const DOMINIO_REDE = "SMARAPD.COM.BR";

interface ModalLoginProps {
  aoAutenticar: (usuario: string) => void;
}

function extrairMensagemErro(erro: unknown): string {
  if (axios.isAxiosError(erro)) {
    const mensagem = (erro.response?.data as { mensagem?: string } | undefined)
      ?.mensagem;
    if (mensagem) return mensagem;
  }
  return "Não foi possível validar as credenciais. Tente novamente.";
}

const estiloCampo = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "4px",
  border: "1px solid #cfd8dc",
  height: "34px",
  boxSizing: "border-box" as const,
};

const estiloRotulo = {
  display: "block",
  fontWeight: 700,
  fontSize: "0.75rem",
  color: "#455a64",
  marginBottom: "4px",
  textTransform: "uppercase" as const,
};

export function ModalLogin({ aoAutenticar }: ModalLoginProps) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (enviando) return;

    if (!usuario.trim() || !senha) {
      setErro("Informe o usuário e a senha da rede.");
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const usuarioAutenticado = await sessaoService.entrar(
        usuario.trim(),
        senha,
      );
      aoAutenticar(usuarioAutenticado);
    } catch (falha) {
      setSenha("");
      setErro(extrairMensagemErro(falha));
    } finally {
      setEnviando(false);
    }
  };

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
      }}
    >
      <form
        onSubmit={entrar}
        autoComplete="off"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "4px",
          border: "1px solid #cfd8dc",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          width: "90%",
          maxWidth: "380px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            backgroundColor: "#e0f2f1",
            borderBottom: "1px solid #b2dfdb",
            padding: "12px 16px",
          }}
        >
          <strong style={{ color: "#00796b", fontSize: "0.95rem" }}>
            Acesso ao SVD
          </strong>
        </div>

        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            color: "#37474f",
            fontSize: "0.85rem",
          }}
        >
          <p style={{ margin: 0 }}>
            Informe o usuário e a senha da rede Windows (domínio{" "}
            <strong>{DOMINIO_REDE}</strong>).
          </p>

          <div>
            <label htmlFor="input-usuario-login" style={estiloRotulo}>
              Usuário:
            </label>
            <input
              id="input-usuario-login"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              disabled={enviando}
              autoFocus
              style={estiloCampo}
            ></input>
          </div>

          <div>
            <label htmlFor="input-senha-login" style={estiloRotulo}>
              Senha:
            </label>
            <input
              id="input-senha-login"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              style={estiloCampo}
            ></input>
          </div>

          {erro && (
            <div
              role="alert"
              style={{
                color: "#c62828",
                backgroundColor: "#ffebee",
                border: "1px solid #ffcdd2",
                borderRadius: "4px",
                padding: "6px 10px",
                fontSize: "0.8rem",
              }}
            >
              {erro}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 16px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #eceff1",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="submit"
            disabled={enviando}
            style={{
              backgroundColor: "#00796b",
              color: "#ffffff",
              border: "none",
              padding: "6px 18px",
              borderRadius: "4px",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: enviando ? "wait" : "pointer",
              opacity: enviando ? 0.7 : 1,
            }}
          >
            <span>{enviando ? "Validando..." : "Entrar"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
