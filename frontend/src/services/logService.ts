import axios from "axios";

// Instância isolada apenas para gravação de logs
const logApi = axios.create({ baseURL: "http://localhost:5224/api" });

export interface LogCriacao {
  tipo?: "Erro" | "Exceção" | "Informação" | "Aviso";
  mensagem: string;
  origem: string;
  stackTrace?: string;
  detalhes?: string;
}

export const logService = {
  registrarErro: async (log: LogCriacao) => {
    try {
      const payload = {
        ...log,
        tipo: log.tipo || "Erro",
        origem: `Front-end - ${log.origem}`,
        detalhes: log.detalhes
          ? `${log.detalhes} | Navegador: ${navigator.userAgent}`
          : `Navegador: ${navigator.userAgent}`,
      };
      await logApi.post("/logs", payload);
    } catch (e) {
      console.error("Falha crítica ao enviar log para o servidor:", e);
    }
  },

  registrarInfo: async (mensagem: string, origem: string) => {
    return logService.registrarErro({ tipo: "Informação", mensagem, origem });
  },
};
