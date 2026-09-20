export type TipoProvedorBanco = "SQL Server";

export interface RegiaoCampo {
  id: string;
  nomeCampo: string;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
  pagina?: number;
  ehIdentificadorPrimeiraPagina?: boolean;
  textoEsperadoIdentificador?: string;
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

export interface ConexaoBancoLayout {
  provedor?: TipoProvedorBanco;
  servidor: string;
  porta?: number;
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
  conexaoBanco?: ConexaoBancoLayout;
}
