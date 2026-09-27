import axios from "axios";
<<<<<<< HEAD
import { CABECALHO_TOKEN_SESSAO, tokenSessao } from "./tokenSessao";

// Instância isolada apenas para gravação de logs
const logApi = axios.create({ baseURL: "/api" });
=======

// Instância isolada apenas para gravação de logs
const logApi = axios.create({ baseURL: "http://localhost:5224/api" });
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

export interface LogCriacao {
  tipo?: "Erro" | "Exceção" | "Informação" | "Aviso";
  mensagem: string;
  origem: string;
  stackTrace?: string;
  detalhes?: string;
}

export const logService = {
  registrarErro: async (log: LogCriacao) => {
<<<<<<< HEAD
    // O servidor só aceita logs de sessões autenticadas
    const token = tokenSessao.obter();
    if (!token) return;

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    try {
      const payload = {
        ...log,
        tipo: log.tipo || "Erro",
        origem: `Front-end - ${log.origem}`,
        detalhes: log.detalhes
          ? `${log.detalhes} | Navegador: ${navigator.userAgent}`
          : `Navegador: ${navigator.userAgent}`,
      };
<<<<<<< HEAD
      await logApi.post("/logs", payload, {
        headers: { [CABECALHO_TOKEN_SESSAO]: token },
      });
=======
      await logApi.post("/logs", payload);
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
    } catch (e) {
      console.error("Falha crítica ao enviar log para o servidor:", e);
    }
  },

  registrarInfo: async (mensagem: string, origem: string) => {
    return logService.registrarErro({ tipo: "Informação", mensagem, origem });
  },
};
