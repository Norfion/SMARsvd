import type { ResultadoValidacaoLote } from "../types/validacao";
import { api } from "./api";

export interface RespostaExtracaoApi {
  extracao?: {
    percentualAmostragem?: number;
    totalDocumentos?: number;
    documentosProcessados?: number;
    usouOcr?: boolean;
    documentos?: Array<{
      paginaInicio: number;
      paginaFim: number;
      campos: Array<{
        nome: string;
        valorExtraido?: string;
        paginaExtraido?: number;
        extracaoMetodo?: string;
      }>;
    }>;
  };
  status?: string;
}

export const processamentoService = {
  extrair: async (
    arquivo: File,
    layoutId: string,
    amostragem: number,
  ): Promise<RespostaExtracaoApi> => {
    const formData = new FormData();
    formData.append("ArquivoPdf", arquivo);
    formData.append("LayoutId", layoutId);
    formData.append("Amostragem", amostragem.toString());

    const resposta = await api.post<RespostaExtracaoApi>(
      "/processamento/extrair",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return resposta.data;
  },

  buscarBanco: async (
    layoutId: string,
    nomeArquivo: string = "",
    usouOcr: boolean = false,
  ): Promise<void> => {
    await api.post("/processamento/buscar-banco", {
      layoutId,
      nomeArquivo: nomeArquivo || "arquivo_importado.pdf",
      usouOcr,
    });
  },

  validarRegras: async (
    layoutId: string,
    nomeArquivo: string,
    usouOcr: boolean,
  ): Promise<ResultadoValidacaoLote> => {
    const resposta = await api.post<ResultadoValidacaoLote>(
      "/processamento/validar-regras",
      {
        layoutId,
        nomeArquivo: nomeArquivo || "arquivo_importado.pdf",
        usouOcr,
      },
    );
    return resposta.data;
  },
};
