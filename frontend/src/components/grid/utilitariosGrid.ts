import type { ModeloFiltroLista, ModeloFiltroTexto } from "./FiltrosGrid";

export const COLUNA_SELECAO = "selecao";

export function descreverFiltro(
  modelo: ModeloFiltroTexto | ModeloFiltroLista,
): string[] {
  if ("valores" in modelo) return modelo.valores;

  if (modelo.somenteVazio) return ["Somente Vazio"];

  const partes: string[] = [];
  if (modelo.contem) partes.push(`Contém: ${modelo.contem}`);
  if (modelo.comecaCom) partes.push(`Começa com: ${modelo.comecaCom}`);
  if (modelo.naoCoincidentes) partes.push("Registros não coincidentes");
  return partes;
}
