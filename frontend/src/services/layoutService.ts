import type { LayoutCliente, ResultadoValidacaoSql } from "../types/layout";
import { api } from "./api";

export const layoutService = {
  // Busca todos os layouts salvos no banco
  listarTodos: async (): Promise<LayoutCliente[]> => {
    const resposta = await api.get<LayoutCliente[]>("/layouts");
    return resposta.data;
  },

  // Envia o layout demarcado para salvar no banco
  salvar: async (layout: LayoutCliente): Promise<string> => {
    const resposta = await api.post<string>("/layouts", layout);
    return resposta.data;
  },

  excluir: async (id: string): Promise<void> => {
    await api.delete(`/layouts/${id}`);
  },

  // Verifica a sintaxe da query e se ela é um único SELECT
  validarSql: async (sql: string): Promise<ResultadoValidacaoSql> => {
    const resposta = await api.post<ResultadoValidacaoSql>(
      "/layouts/validar-sql",
      { sql },
    );
    return resposta.data;
  },
};
