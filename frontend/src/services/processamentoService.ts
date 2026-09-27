import type { ResultadoValidacaoLote } from "../types/validacao";
import type { ConfiguracaoBanco } from "../types/layout";
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
        situacao?: "Ok" | "Ausente" | "Invalido";
        mensagemValidacao?: string;
        textoRegiao?: string;
      }>;
    }>;
  };
  status?: string;
}

export interface RespostaTesteConexaoApi {
  status?: string;
  inicioProcessamento?: string;
}

export interface SituacaoFilaProcessamento {
  liberado: boolean;
  naFila: boolean;
  // Na fila: quantas validações serão atendidas até a do usuário (1 = a próxima).
  // Fora dela: a posição que o usuário ocuparia se entrasse.
  posicao: number;
}

export const processamentoService = {
  entrarNaFila: async (
    aguardarNaFila: boolean,
  ): Promise<SituacaoFilaProcessamento> => {
    const resposta = await api.post<SituacaoFilaProcessamento>(
      "/processamento/fila/entrar",
      { aguardarNaFila },
    );
    return resposta.data;
  },

  sairDaFila: async (): Promise<void> => {
    await api.post("/processamento/fila/sair");
  },

  testarConexao: async (
    conexaoBanco: ConfiguracaoBanco,
  ): Promise<RespostaTesteConexaoApi> => {
    const resposta = await api.post<RespostaTesteConexaoApi>(
      "/processamento/testar-conexao",
      conexaoBanco,
    );
    return resposta.data;
  },

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
    conexaoBanco: ConfiguracaoBanco,
    nomeArquivo: string = "",
    usouOcr: boolean = false,
  ): Promise<void> => {
    await api.post("/processamento/buscar-banco", {
      layoutId,
      nomeArquivo: nomeArquivo || "arquivo_importado.pdf",
      usouOcr,
      conexaoBanco,
    });
  },

  validarRegras: async (
    layoutId: string,
    nomeArquivo: string,
    usouOcr: boolean,
    inicioProcessamento?: string,
  ): Promise<ResultadoValidacaoLote> => {
    const resposta = await api.post<ResultadoValidacaoLote>(
      "/processamento/validar-regras",
      {
        layoutId,
        nomeArquivo: nomeArquivo || "arquivo_importado.pdf",
        usouOcr,
        inicioProcessamento,
      },
    );
    return resposta.data;
  },
};
