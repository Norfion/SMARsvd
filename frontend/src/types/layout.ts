export type TipoProvedorBanco = "SQL Server";

export enum TipoClassificacaoCampo {
  Nenhum = 0,
  IdentificadorDocumento = 1,
  IdentificadorPagina = 2,
}

export interface RegiaoCampo {
  id: string;
  nomeCampo: string;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
  pagina?: number;

  // Classificação única e mutuamente exclusiva
  tipoClassificacao: TipoClassificacaoCampo;

  // Identificador de documento (delimita início/fim do documento no lote)
  textoEsperadoDocumento?: string;

  // Identificador de página (classifica o tipo/estrutura da página)
  textoEsperadoPagina?: string;

  // Vínculo para campo normal: nome do identificador de página
  identificadorPagina?: string;

  // Identificador anterior (somente para campo normal)
  identificadorAnterior?: string;
  consultaSql?: string;
}

export interface RegraValidacao {
  id: string;
  campoRetornado: string;
  operador: string;
  campoCarne: string;
}

export interface QueryValidacao {
  id: string;
  nome: string;
  sql: string;
  parametrosEncontrados?: string[];
  camposRetornados?: string[];
  regras: RegraValidacao[];
}

// Configuração temporária preenchida apenas no momento da validação
export interface ConfiguracaoBanco {
  provedor: TipoProvedorBanco;
  servidor: string;
  porta: number;
  baseDados: string;
  usuario: string;
  senha?: string;
}

export interface LayoutCliente {
  id?: string;
  cliente: string;
  nomeModelo: string;
  versao: number;
  larguraPaginaMm: number;
  alturaPaginaMm: number;
  campos: RegiaoCampo[];
  queriesValidacao?: QueryValidacao[];
  paginasModeloBase64?: string[];
  nomeArquivoModelo?: string;
}
