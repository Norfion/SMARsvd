import axios from "axios";
import { useState, type FormEvent } from "react";
import { sessaoService } from "../services/sessaoService";
import logoImg from "../assets/logo-smartb.png";
import { NOME_MODULO, NOME_SISTEMA } from "../constants/identificacaoSistema";

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

// Tela de acesso no padrão de login dos sistemas da empresa (login.scss do Common)
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
    <div className="login-container">
      <div className="main-logo">
        <img alt={NOME_SISTEMA} src={logoImg} />
      </div>

      <form className="form" onSubmit={entrar} autoComplete="off">
        <h2>{NOME_MODULO}</h2>

        <p className="mb-2" style={{ lineHeight: 1.5 }}>
          Informe o usuário e a senha da rede Windows (domínio{" "}
          <strong>{DOMINIO_REDE}</strong>).
        </p>

        <div className="form-group">
          <label htmlFor="input-usuario-login">
            Usuário
            <span className="required-star"></span>
          </label>
          <input
            id="input-usuario-login"
            className="form-control"
            type="text"
            placeholder="Usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            disabled={enviando}
            autoFocus
          ></input>
        </div>

        <div className="form-group">
          <label htmlFor="input-senha-login">
            Senha
            <span className="required-star"></span>
          </label>
          <input
            id="input-senha-login"
            className="form-control"
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={enviando}
          ></input>
        </div>

        {erro && (
          <div role="alert" className="alert alert-inline alert-danger mt-3">
            <i className="fas fa-exclamation-circle"></i>
            <span>{erro}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block login-button mt-3"
          disabled={enviando}
        >
          <i
            className={
              enviando ? "fas fa-spinner fa-spin" : "fas fa-sign-in-alt"
            }
          ></i>{" "}
          {enviando ? "Validando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
