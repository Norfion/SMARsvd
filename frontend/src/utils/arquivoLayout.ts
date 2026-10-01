import { gerarId } from "./gerarId";
import {
  TipoClassificacaoCampo,
  TipoDadoCampo,
  type LayoutCliente,
  type QueryValidacao,
  type RegiaoCampo,
  type RegraValidacao,
} from "../types/layout";

const FORMATO_ARQUIVO_LAYOUT = "SMARsvd.Layout";
const VERSAO_FORMATO_ARQUIVO_LAYOUT = 1;
const TAMANHO_MAXIMO_ARQUIVO_BYTES = 50 * 1024 * 1024;

const CLASSIFICACOES_VALIDAS: number[] = Object.values(TipoClassificacaoCampo);
const TIPOS_DADO_VALIDOS: number[] = Object.values(TipoDadoCampo);

type RegraExportada = Omit<RegraValidacao, "id">;

type QueryExportada = Pick<QueryValidacao, "nome" | "sql"> & {
  regras: RegraExportada[];
};

type LayoutExportado = Omit<LayoutCliente, "id" | "campos" | "queriesValidacao"> & {
  campos: Omit<RegiaoCampo, "id">[];
  queriesValidacao: QueryExportada[];
};

interface ArquivoLayout {
  formato: typeof FORMATO_ARQUIVO_LAYOUT;
  versaoFormato: number;
  exportadoEm: string;
  layout: LayoutExportado;
}

// Caracteres proibidos em nomes de arquivo no Windows
const removerCaracteresInvalidosNomeArquivo = (nome: string) =>
  nome
    .replace(/[<>:"/\\|?*]/g, "_")
    .split("")
    .filter((caractere) => caractere.charCodeAt(0) >= 32)
    .join("")
    .replace(/[. ]+$/, "")
    .trim();

export function gerarNomeArquivoLayout(nomeLayout: string): string {
  const nomeSeguro = removerCaracteresInvalidosNomeArquivo(nomeLayout) || "layout";
  return `SMARsvd_layout_${nomeSeguro}.json`;
}

// Os IDs são do banco de cada computador e não fazem sentido em outra instalação
export function exportarArquivoLayout(layout: LayoutCliente) {
  const arquivo: ArquivoLayout = {
    formato: FORMATO_ARQUIVO_LAYOUT,
    versaoFormato: VERSAO_FORMATO_ARQUIVO_LAYOUT,
    exportadoEm: new Date().toISOString(),
    layout: {
      cliente: layout.cliente,
      nomeModelo: layout.nomeModelo,
      versao: layout.versao,
      larguraPaginaMm: layout.larguraPaginaMm,
      alturaPaginaMm: layout.alturaPaginaMm,
      nomeArquivoModelo: layout.nomeArquivoModelo,
      campos: (layout.campos || []).map((campo) => ({
        nomeCampo: campo.nomeCampo,
        xMm: campo.xMm,
        yMm: campo.yMm,
        larguraMm: campo.larguraMm,
        alturaMm: campo.alturaMm,
        pagina: campo.pagina,
        tipoClassificacao: campo.tipoClassificacao,
        textoEsperadoDocumento: campo.textoEsperadoDocumento,
        textoEsperadoPagina: campo.textoEsperadoPagina,
        identificadorPagina: campo.identificadorPagina,
        identificadorAnterior: campo.identificadorAnterior,
        identificadorPosterior: campo.identificadorPosterior,
        tipoDado: campo.tipoDado,
        consultaSql: campo.consultaSql,
      })),
      queriesValidacao: (layout.queriesValidacao || []).map((query) => ({
        nome: query.nome,
        sql: query.sql,
        regras: (query.regras || []).map((regra) => ({
          campoRetornado: regra.campoRetornado,
          operador: regra.operador,
          campoCarne: regra.campoCarne,
        })),
      })),
      paginasModeloBase64: layout.paginasModeloBase64 || [],
    },
  };

  const blob = new Blob([JSON.stringify(arquivo, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = gerarNomeArquivoLayout(layout.nomeModelo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revogar no mesmo ciclo do clique pode cancelar o download antes de ele começar
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ehObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

const ehNumero = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isFinite(valor);

const textoOpcional = (valor: unknown, descricao: string): string | undefined => {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== "string") {
    throw new Error(`O campo "${descricao}" deve ser um texto.`);
  }
  return valor;
};

const textoObrigatorio = (valor: unknown, descricao: string): string => {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new Error(`O campo "${descricao}" é obrigatório.`);
  }
  return valor;
};

const numeroObrigatorio = (valor: unknown, descricao: string): number => {
  if (!ehNumero(valor)) {
    throw new Error(`O campo "${descricao}" deve ser um número.`);
  }
  return valor;
};

const listaOpcional = (valor: unknown, descricao: string): unknown[] => {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    throw new Error(`O campo "${descricao}" deve ser uma lista.`);
  }
  return valor;
};

const converterCampo = (valor: unknown, posicao: number): RegiaoCampo => {
  const descricao = `campos[${posicao + 1}]`;
  if (!ehObjeto(valor)) {
    throw new Error(`O item ${descricao} do arquivo é inválido.`);
  }

  const tipoClassificacao = valor.tipoClassificacao ?? TipoClassificacaoCampo.Nenhum;
  if (!CLASSIFICACOES_VALIDAS.includes(tipoClassificacao as number)) {
    throw new Error(`O campo "${descricao}.tipoClassificacao" possui um valor desconhecido.`);
  }

  const tipoDado = valor.tipoDado ?? TipoDadoCampo.Texto;
  if (!TIPOS_DADO_VALIDOS.includes(tipoDado as number)) {
    throw new Error(`O campo "${descricao}.tipoDado" possui um valor desconhecido.`);
  }

  const pagina = valor.pagina ?? 1;
  if (!Number.isInteger(pagina) || (pagina as number) < 1) {
    throw new Error(`O campo "${descricao}.pagina" deve ser um número inteiro positivo.`);
  }

  return {
    id: gerarId(),
    nomeCampo: textoObrigatorio(valor.nomeCampo, `${descricao}.nomeCampo`),
    xMm: numeroObrigatorio(valor.xMm, `${descricao}.xMm`),
    yMm: numeroObrigatorio(valor.yMm, `${descricao}.yMm`),
    larguraMm: numeroObrigatorio(valor.larguraMm, `${descricao}.larguraMm`),
    alturaMm: numeroObrigatorio(valor.alturaMm, `${descricao}.alturaMm`),
    pagina: pagina as number,
    tipoClassificacao: tipoClassificacao as TipoClassificacaoCampo,
    textoEsperadoDocumento: textoOpcional(valor.textoEsperadoDocumento, `${descricao}.textoEsperadoDocumento`),
    textoEsperadoPagina: textoOpcional(valor.textoEsperadoPagina, `${descricao}.textoEsperadoPagina`),
    identificadorPagina: textoOpcional(valor.identificadorPagina, `${descricao}.identificadorPagina`),
    identificadorAnterior: textoOpcional(valor.identificadorAnterior, `${descricao}.identificadorAnterior`),
    identificadorPosterior: textoOpcional(valor.identificadorPosterior, `${descricao}.identificadorPosterior`),
    tipoDado: tipoDado as TipoDadoCampo,
    consultaSql: textoOpcional(valor.consultaSql, `${descricao}.consultaSql`),
  };
};

const converterRegra = (valor: unknown, descricao: string): RegraValidacao => {
  if (!ehObjeto(valor)) {
    throw new Error(`O item ${descricao} do arquivo é inválido.`);
  }

  return {
    id: gerarId(),
    campoRetornado: textoObrigatorio(valor.campoRetornado, `${descricao}.campoRetornado`),
    operador: textoObrigatorio(valor.operador, `${descricao}.operador`),
    campoCarne: textoObrigatorio(valor.campoCarne, `${descricao}.campoCarne`),
  };
};

const converterQuery = (valor: unknown, posicao: number): QueryValidacao => {
  const descricao = `queriesValidacao[${posicao + 1}]`;
  if (!ehObjeto(valor)) {
    throw new Error(`O item ${descricao} do arquivo é inválido.`);
  }

  return {
    id: gerarId(),
    nome: textoObrigatorio(valor.nome, `${descricao}.nome`),
    sql: textoObrigatorio(valor.sql, `${descricao}.sql`),
    regras: listaOpcional(valor.regras, `${descricao}.regras`).map((regra, indice) =>
      converterRegra(regra, `${descricao}.regras[${indice + 1}]`),
    ),
  };
};

// Valida a estrutura do arquivo; SQL, imagens e tamanhos dos textos são conferidos novamente pelo servidor ao salvar
export async function lerArquivoLayout(arquivo: File): Promise<LayoutCliente> {
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    throw new Error("O arquivo é grande demais para ser um layout do SMARsvd.");
  }

  let conteudo: unknown;
  try {
    conteudo = JSON.parse(await arquivo.text());
  } catch {
    throw new Error("O arquivo não está em um formato JSON válido.");
  }

  if (!ehObjeto(conteudo) || conteudo.formato !== FORMATO_ARQUIVO_LAYOUT || !ehObjeto(conteudo.layout)) {
    throw new Error("O arquivo selecionado não é um layout exportado pelo SMARsvd.");
  }

  if (!ehNumero(conteudo.versaoFormato) || conteudo.versaoFormato > VERSAO_FORMATO_ARQUIVO_LAYOUT) {
    throw new Error(
      "O arquivo foi gerado por uma versão mais recente do SMARsvd. Atualize o sistema para importá-lo.",
    );
  }

  const layout = conteudo.layout;
  const paginasModelo = listaOpcional(layout.paginasModeloBase64, "paginasModeloBase64");
  if (paginasModelo.some((pagina) => typeof pagina !== "string")) {
    throw new Error('O campo "paginasModeloBase64" deve conter apenas imagens.');
  }

  const versao = layout.versao ?? 1;

  return {
    cliente: textoObrigatorio(layout.cliente, "cliente").trim(),
    nomeModelo: textoObrigatorio(layout.nomeModelo, "nomeModelo").trim(),
    versao: Number.isInteger(versao) ? (versao as number) : 1,
    larguraPaginaMm: numeroObrigatorio(layout.larguraPaginaMm, "larguraPaginaMm"),
    alturaPaginaMm: numeroObrigatorio(layout.alturaPaginaMm, "alturaPaginaMm"),
    nomeArquivoModelo: textoOpcional(layout.nomeArquivoModelo, "nomeArquivoModelo"),
    campos: listaOpcional(layout.campos, "campos").map(converterCampo),
    queriesValidacao: listaOpcional(layout.queriesValidacao, "queriesValidacao").map(converterQuery),
    paginasModeloBase64: paginasModelo as string[],
  };
}
