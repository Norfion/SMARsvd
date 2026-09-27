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
  // Suporte flexível a PascalCase e camelCase
  identificadorGuia?: string;
  IdentificadorGuia?: string;

  paginaExtraido?: number;
  PaginaExtraido?: number;

  campo?: string;
  Campo?: string;

  valorExtraidoPdf?: string;
  ValorExtraidoPdf?: string;

  valorEsperadoBanco?: string;
  ValorEsperadoBanco?: string;

  status?: string;
  Status?: string;

  mensagemAuditoria?: string;
  MensagemAuditoria?: string;
  mensagem?: string;
  Mensagem?: string;
}

export interface ValidacaoDetalhadaItem {
  identificadorGuia?: string;
  IdentificadorGuia?: string;

  paginaExtraido?: number;
  PaginaExtraido?: number;

  nomeQuery?: string;
  NomeQuery?: string;

  campoLayout?: string;
  CampoLayout?: string;

  campoBanco?: string;
  CampoBanco?: string;

  regraAplicada?: string;
  RegraAplicada?: string;

  valorExtraido?: string;
  ValorExtraido?: string;

  valorBanco?: string;
  ValorBanco?: string;

  status?: string;
  Status?: string;

  mensagemAuditoria?: string;
  MensagemAuditoria?: string;

  mensagem?: string;
  Mensagem?: string;
}

export interface FalhaProcessamentoItem {
  origem?: string;
  Origem?: string;

  tipo?: string;
  Tipo?: string;

  mensagem?: string;
  Mensagem?: string;

  paginaInicio?: number | null;
  PaginaInicio?: number | null;

  paginaFim?: number | null;
  PaginaFim?: number | null;

  nomeQuery?: string | null;
  NomeQuery?: string | null;

  detalhes?: string | null;
  Detalhes?: string | null;

  dataHora?: string | null;
  DataHora?: string | null;
}

export interface ResultadoValidacaoLote {
  nomeArquivo?: string;
  NomeArquivo?: string;

  layoutUtilizado?: string;
  LayoutUtilizado?: string;

  baseDados?: string;
  BaseDados?: string;

  totalDocumentosAnalisados?: number;
  TotalDocumentosAnalisados?: number;
  totalGuiasAnalisadas?: number;
  TotalGuiasAnalisadas?: number;

  documentosValidos?: number;
  DocumentosValidos?: number;
  guiasValidas?: number;
  GuiasValidas?: number;

  documentosComInconsistencia?: number;
  DocumentosComInconsistencia?: number;
  guiasComInconsistencia?: number;
  GuiasComInconsistencia?: number;

  percentualAmostragem?: number;
  PercentualAmostragem?: number;

  usouOcr?: boolean;
  UsouOcr?: boolean;

  dataHoraInicio?: string | null;
  DataHoraInicio?: string | null;

  dataHoraFim?: string | null;
  DataHoraFim?: string | null;

  falhas?: FalhaProcessamentoItem[];
  Falhas?: FalhaProcessamentoItem[];

  inconsistencias?: InconsistenciaItem[];
  Inconsistencias?: InconsistenciaItem[];

  validacoes?: ValidacaoDetalhadaItem[];
  Validacoes?: ValidacaoDetalhadaItem[];
}
