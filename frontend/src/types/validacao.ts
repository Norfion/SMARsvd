export interface InconsistenciaItem {
  paginaExtraido: number;
  campo: string;
  valorExtraidoPdf: string;
  valorEsperadoBanco: string;
  mensagemAuditoria: string;
}

export interface ValidacaoDetalhadaItem {
  paginaExtraido: number;
  nomeQuery: string;
  campoLayout: string;
  campoBanco: string;
  regraAplicada: string;
  valorExtraido: string;
  valorBanco: string;
  status: string;
  mensagemAuditoria: string;
}

export interface FalhaProcessamentoItem {
  origem: string;
  tipo: string;
  mensagem: string;
  paginaInicio?: number | null;
  paginaFim?: number | null;
  nomeQuery?: string | null;
  detalhes?: string | null;
  dataHora?: string | null;
}

export interface ResultadoValidacaoLote {
  nomeArquivo: string;
  layoutUtilizado: string;
  // Preenchido pela tela de Validação: o backend não devolve o nome da base consultada
  baseDados?: string;
  totalDocumentosAnalisados: number;
  documentosValidos: number;
  documentosComInconsistencia: number;
  percentualAmostragem: number;
  usouOcr: boolean;
  dataHoraInicio?: string | null;
  dataHoraFim?: string | null;
  falhas: FalhaProcessamentoItem[];
  inconsistencias: InconsistenciaItem[];
  validacoes: ValidacaoDetalhadaItem[];
}
