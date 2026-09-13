export type OrientacaoPagina = "Retrato" | "Paisagem";
export type FormatoPapel = "A4" | "Carta" | "Personalizado";

export interface RegiaoCampo {
  id: string;
  nomeCampo: string;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
  consultaSql: string;
  ehIdentificadorPrimeiraPagina?: boolean;
  textoEsperadoIdentificador?: string;
}

// O layout agora é associado a um Cliente / Município
export interface LayoutCliente {
  id?: string;
  cliente: string; // Ex: "PM Sertãozinho - SP", "PM Serra - ES"
  nomeModelo: string; // Ex: "Carnê IPTU/ISS 2026 - Padrão"
  versao: number;
  orientacao: OrientacaoPagina;
  formatoPapel: FormatoPapel;
  larguraPaginaMm: number;
  alturaPaginaMm: number;
  campos: RegiaoCampo[];
}
