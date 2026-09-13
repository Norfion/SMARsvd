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
