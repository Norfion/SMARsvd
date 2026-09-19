import axios from "axios";
import type { LayoutCliente } from "../types/layout";

// Configura a URL base da nossa API .NET
const api = axios.create({
  baseURL: "http://localhost:5224/api",
});

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
};