import axios from "axios";
import { logService } from "./logService";

export const api = axios.create({
  baseURL: "http://localhost:5224/api",
});

// Emite eventos de conexão para que o App.tsx reaja imediatamente
export function dispararStatusConexao(semConexao: boolean) {
  window.dispatchEvent(
    new CustomEvent("eventoConexaoBanco", {
      detail: { semConexao },
    }),
  );
}

// Interceptor de Resposta: monitora o sucesso e as quedas do banco/servidor
api.interceptors.response.use(
  (response) => {
    // Se respondeu com sucesso, garante que o alerta de desconexão seja desativado
    dispararStatusConexao(false);
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const ehFalhaDeRede = !error.response || error.code === "ERR_NETWORK";
    const ehFalhaDeServidorOuBanco = status === 500 || status === 503;

    // Se o backend/banco estiver inacessível ou estourar erro 500/503, aciona a tela de erro
    if (ehFalhaDeRede || ehFalhaDeServidorOuBanco) {
      dispararStatusConexao(true);
    }

    if (error.response) {
      logService.registrarErro({
        mensagem: `Erro na API: Status ${error.response.status}`,
        origem: `Chamada HTTP (${error.config?.url})`,
        detalhes: JSON.stringify(error.response.data),
      });
    } else if (error.request) {
      logService.registrarErro({
        mensagem: `Falha de comunicação ou servidor offline: ${error.message}`,
        origem: `Chamada HTTP (${error.config?.url})`,
      });
    } else {
      logService.registrarErro({
        mensagem: `Erro na montagem da requisição: ${error.message}`,
        origem: "Axios Client",
      });
    }

    return Promise.reject(error);
  },
);
