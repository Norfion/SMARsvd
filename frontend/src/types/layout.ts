export type TipoProvedorBanco = "SQL Server";

export type FormatoPapel = "A4" | "Carta" | "Personalizado";

export type OrientacaoPagina = "Retrato" | "Paisagem";

export const TipoClassificacaoCampo = {
  Nenhum: 0,
  IdentificadorDocumento: 1,
  IdentificadorPagina: 2,
} as const;

export type TipoClassificacaoCampo =
  (typeof TipoClassificacaoCampo)[keyof typeof TipoClassificacaoCampo];

export const TipoDadoCampo = {
  Texto: 0,
  Inteiro: 1,
  Decimal: 2,
  Data: 3,
  CpfCnpj: 4,
  Cep: 5,
} as const;

export type TipoDadoCampo = (typeof TipoDadoCampo)[keyof typeof TipoDadoCampo];

export const OPCOES_TIPO_DADO: {
  valor: TipoDadoCampo;
  rotulo: string;
  exemplo: string;
}[] = [
  { valor: TipoDadoCampo.Texto, rotulo: "Texto", exemplo: "Todo o texto entre os identificadores" },
  { valor: TipoDadoCampo.Inteiro, rotulo: "Número inteiro", exemplo: "123017" },
  { valor: TipoDadoCampo.Decimal, rotulo: "Número decimal", exemplo: "1.234,56" },
  { valor: TipoDadoCampo.Data, rotulo: "Data", exemplo: "24/11/2023" },
  { valor: TipoDadoCampo.CpfCnpj, rotulo: "CPF/CNPJ", exemplo: "123.456.789-00 ou 12.345.678/0001-90" },
  { valor: TipoDadoCampo.Cep, rotulo: "CEP", exemplo: "12345-678" },
];

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

  // Identificadores anterior/posterior (somente para campo normal)
  identificadorAnterior?: string;
  identificadorPosterior?: string;

  // Formato esperado do valor (somente para campo normal)
  tipoDado?: TipoDadoCampo;
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

export interface ErroSql {
  linha: number;
  coluna: number;
  mensagem: string;
}

export interface ResultadoValidacaoSql {
  valida: boolean;
  erros: ErroSql[];
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
