export type OrientacaoPagina = "Retrato" | "Paisagem";
export type FormatoPapel = "A4" | "Carta" | "Personalizado";

export interface RegiaoCampo {
  id: string;
  nomeCampo: string;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
  pagina: number;
  ehIdentificadorPrimeiraPagina?: boolean;
  textoEsperadoIdentificador?: string;
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
  parametrosEncontrados: string[];
  camposRetornados: string[];
  regras: RegraValidacao[];
}

export interface LayoutCliente {
  id?: string;
  cliente: string;
  nomeModelo: string;
  versao: number;
  orientacao: OrientacaoPagina;
  formatoPapel: FormatoPapel;
  larguraPaginaMm: number;
  alturaPaginaMm: number;
  quantidadePaginasPadrao: number;
  campos: RegiaoCampo[];
  queriesValidacao: QueryValidacao[];
  // Armazena as imagens de gabarito das páginas quando originado de um PDF modelo
  paginasModeloBase64?: string[];
  nomeArquivoModelo?: string;
}
