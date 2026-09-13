export interface CarneResumo {
  numeroDocumento: string;
  contribuinte: string;
  cpfCnpj: string;
  exercicio: number;
  valorTotal: number;
  vencimento: string;
  status: "Pendente" | "Válido" | "Com Erro";
}
