import axios from "axios";
import { logService } from "./logService";

export const api = axios.create({
  baseURL: "http://localhost:5224/api",
});

// Interceptor: Tudo que der erro nas chamadas HTTP passa por aqui
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      logService.registrarErro({
        mensagem: `Erro na API: Status ${error.response.status}`,
        origem: `Chamada HTTP (${error.config.url})`,
        detalhes: JSON.stringify(error.response.data),
      });
    } else if (error.request) {
      logService.registrarErro({
        mensagem: `Falha de comunicação ou servidor offline: ${error.message}`,
        origem: `Chamada HTTP (${error.config.url})`,
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
