import axios from "axios";
import { logService } from "./logService";
<<<<<<< HEAD
import { CABECALHO_TOKEN_SESSAO, tokenSessao } from "./tokenSessao";

export const api = axios.create({
  baseURL: "/api",
=======

export const api = axios.create({
  baseURL: "http://localhost:5224/api",
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
});

// Emite eventos de conexão para que o App.tsx reaja imediatamente
export function dispararStatusConexao(semConexao: boolean) {
  window.dispatchEvent(
    new CustomEvent("eventoConexaoBanco", {
      detail: { semConexao },
    }),
  );
}

<<<<<<< HEAD
// Avisa o App.tsx que a sessão não é mais aceita pelo servidor e o login deve ser refeito
export function dispararSessaoExpirada() {
  window.dispatchEvent(new CustomEvent("eventoSessaoExpirada"));
}

api.interceptors.request.use((config) => {
  const token = tokenSessao.obter();
  if (token) {
    config.headers.set(CABECALHO_TOKEN_SESSAO, token);
  }
  return config;
});

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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

<<<<<<< HEAD
    // Credenciais recusadas no login são tratadas pela própria tela de login
    if (status === 401) {
      if (error.config?.url !== "/autenticacao/login") {
        dispararSessaoExpirada();
      }
      return Promise.reject(error);
    }

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
