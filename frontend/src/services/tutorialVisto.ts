// Mantido no localStorage por usuário: o tutorial abre sozinho apenas no primeiro acesso de cada pessoa neste navegador
const PREFIXO_CHAVE_TUTORIAL = "smarsvd.tutorialVisto.";

const chaveDoUsuario = (usuario: string) =>
  `${PREFIXO_CHAVE_TUTORIAL}${usuario.toLowerCase()}`;

export const tutorialVisto = {
  verificar: (usuario: string): boolean =>
    localStorage.getItem(chaveDoUsuario(usuario)) === "1",
  marcar: (usuario: string) =>
    localStorage.setItem(chaveDoUsuario(usuario), "1"),
};
