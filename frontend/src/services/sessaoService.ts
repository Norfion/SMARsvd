import { api } from "./api";
import { tokenSessao } from "./tokenSessao";

interface RespostaLogin {
  token: string;
  usuario: string;
  dominio: string;
}

interface RespostaSessao {
  usuario: string;
  dominio: string;
}

// Precisa ser bem menor que o tempo de retenção do servidor (5 min), mesmo com o navegador
// espaçando os timers de abas em segundo plano
export const INTERVALO_HEARTBEAT_MS = 45_000;

export const sessaoService = {
  entrar: async (usuario: string, senha: string): Promise<string> => {
    const resposta = await api.post<RespostaLogin>("/autenticacao/login", {
      usuario,
      senha,
    });
    tokenSessao.definir(resposta.data.token);
    return resposta.data.usuario;
  },

  obterUsuarioAtual: async (): Promise<string> => {
    const resposta = await api.get<RespostaSessao>("/autenticacao/sessao");
    return resposta.data.usuario;
  },

  manterAtiva: async (): Promise<void> => {
    await api.post("/autenticacao/heartbeat");
  },

  // sendBeacon garante a entrega mesmo com a aba sendo fechada, mas não aceita cabeçalhos: o token vai no corpo
  encerrar: () => {
    const token = tokenSessao.obter();
    if (!token) return;

    navigator.sendBeacon(
      "/api/autenticacao/encerrar",
      new Blob([JSON.stringify({ token })], { type: "application/json" }),
    );
  },
};
