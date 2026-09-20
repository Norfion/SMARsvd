import axios from "axios";
import type { ResultadoValidacaoLote } from "../types/validacao";

const api = axios.create({
  baseURL: "http://localhost:5224/api",
});

export const processamentoService = {
  validarLote: async (
    arquivo: File,
    layoutId: string,
    amostragem: number,
  ): Promise<ResultadoValidacaoLote> => {
    const formData = new FormData();
    formData.append("arquivoPdf", arquivo);
    formData.append("layoutId", layoutId);
    formData.append("amostragem", amostragem.toString());

    const resposta = await api.post<ResultadoValidacaoLote>(
      "/processamento/lote",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return resposta.data;
  },
};
