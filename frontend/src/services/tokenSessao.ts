// Mantido no sessionStorage: sobrevive ao recarregamento da página, mas é descartado ao fechar a aba
const CHAVE_TOKEN_SESSAO = "smarsvd.tokenSessao";

export const CABECALHO_TOKEN_SESSAO = "X-Sessao-Token";

export const tokenSessao = {
  obter: (): string | null => sessionStorage.getItem(CHAVE_TOKEN_SESSAO),
  definir: (token: string) => sessionStorage.setItem(CHAVE_TOKEN_SESSAO, token),
  limpar: () => sessionStorage.removeItem(CHAVE_TOKEN_SESSAO),
};
