import type { FormatoPapel, OrientacaoPagina } from "../types/layout";

export interface ResultadoLeituraPdfModelo {
  quantidadePaginas: number;
  orientacao: OrientacaoPagina;
  formatoPapel: FormatoPapel;
  larguraMm: number;
  alturaMm: number;
  paginasBase64: string[];
  nomeArquivo: string;
}

// Carrega dinamicamente a biblioteca PDF.js via script tag seguro
async function obterPdfJs(): Promise<any> {
  const windowComPdf = window as any;
  if (windowComPdf.pdfjsLib) {
    return windowComPdf.pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(pdfjs);
    };
    script.onerror = () =>
      reject(new Error("Falha ao carregar o mecanismo de leitura de PDF."));
    document.head.appendChild(script);
  });
}

// 1 ponto tipográfico equivale a 25.4 / 72 milímetros (~0.352778 mm)
const FATOR_PT_PARA_MM = 25.4 / 72;

export async function processarArquivoPdfModelo(
  arquivo: File,
): Promise<ResultadoLeituraPdfModelo> {
  if (
    arquivo.type !== "application/pdf" &&
    !arquivo.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("O arquivo selecionado não é um documento PDF válido.");
  }

  const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024; // Limite de 20MB
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error(
      "O arquivo PDF ultrapassa o tamanho máximo permitido de 20 MB.",
    );
  }

  const pdfjs = await obterPdfJs();
  const bufferArray = await arquivo.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: bufferArray });
  const pdfDoc = await loadingTask.promise;

  const totalPaginas = pdfDoc.numPages;
  if (totalPaginas > 10) {
    throw new Error(
      `O PDF importado possui ${totalPaginas} páginas. O modelo de referência aceita no máximo 10 páginas.`,
    );
  }

  // Analisa a primeira página para extrair a métrica padrão do carnê
  const primeiraPagina = await pdfDoc.getPage(1);
  const viewportPadrao = primeiraPagina.getViewport({ scale: 1.0 });

  const larguraPt = viewportPadrao.width;
  const alturaPt = viewportPadrao.height;

  const larguraMmReal = Number((larguraPt * FATOR_PT_PARA_MM).toFixed(1));
  const alturaMmReal = Number((alturaPt * FATOR_PT_PARA_MM).toFixed(1));

  const orientacao: OrientacaoPagina =
    larguraMmReal >= alturaMmReal ? "Paisagem" : "Retrato";

  // Identificação heurística de formato de papel padrão
  let formato: FormatoPapel = "Personalizado";
  const dimMenor = Math.min(larguraMmReal, alturaMmReal);
  const dimMaior = Math.max(larguraMmReal, alturaMmReal);

  // A4 = 210 x 297 mm (+- tolerância de 3mm de corte)
  if (Math.abs(dimMenor - 210) <= 4 && Math.abs(dimMaior - 297) <= 4) {
    formato = "A4";
  } else if (
    Math.abs(dimMenor - 215.9) <= 4 &&
    Math.abs(dimMaior - 279.4) <= 4
  ) {
    formato = "Carta";
  }

  // Converte cada página em imagem rasterizada em alta resolução (scale: 2.0)
  const paginasBase64: string[] = [];
  for (let numPg = 1; numPg <= totalPaginas; numPg++) {
    const pagina = await pdfDoc.getPage(numPg);
    const viewportRender = pagina.getViewport({ scale: 2.0 });

    const canvas = document.createElement("canvas");
    canvas.width = viewportRender.width;
    canvas.height = viewportRender.height;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      await pagina.render({ canvasContext: ctx, viewport: viewportRender })
        .promise;
      paginasBase64.push(canvas.toDataURL("image/png"));
    }
  }

  return {
    quantidadePaginas: totalPaginas,
    orientacao,
    formatoPapel: formato,
    larguraMm: larguraMmReal,
    alturaMm: alturaMmReal,
    paginasBase64,
    nomeArquivo: arquivo.name,
  };
}
