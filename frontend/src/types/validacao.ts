export interface ErroCarne {
  campo: string;
  valorExtraido: string;
  valorEsperado: string;
  mensagem: string;
}

export interface ResultadoValidacaoCarne {
  numeroDocumento: string;
  contribuinte: string;
  pagina: number;
  status: "Valido" | "Com Erro";
  erros: ErroCarne[];
}
export interface InconsistenciaItem {
  identificadorGuia: string;
  campo: string;
  valorExtraidoPdf: string;
  valorEsperadoBanco: string;
  mensagem: string;
}

export interface ResultadoValidacaoLote {
  nomeArquivo: string;
  layoutUtilizado: string;
  totalGuiasAnalisadas: number;
  guiasValidas: number;
  guiasComInconsistencia: number;
  inconsistencias: InconsistenciaItem[];
  amostragem?: number;
}
