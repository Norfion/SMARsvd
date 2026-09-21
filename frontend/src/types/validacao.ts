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

export interface ResultadoValidacaoLote {
  nomeArquivo?: string;
  NomeArquivo?: string;

  layoutUtilizado?: string;
  LayoutUtilizado?: string;

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

  amostragem?: number;
  Amostragem?: number;

  usouOcr?: boolean;
  UsouOcr?: boolean;

  inconsistencias?: InconsistenciaItem[];
  Inconsistencias?: InconsistenciaItem[];

  validacoes?: ValidacaoDetalhadaItem[];
  Validacoes?: ValidacaoDetalhadaItem[];
}
