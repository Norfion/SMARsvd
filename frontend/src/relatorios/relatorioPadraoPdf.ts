import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Medidas (em pt, papel Carta) dos relatórios DevExpress dos sistemas da empresa
const MARGEM_ESQUERDA = 20.9;
const MARGEM_DIREITA = 590.6;
const LARGURA_UTIL = MARGEM_DIREITA - MARGEM_ESQUERDA;
const ESPESSURA_LINHA = 0.75;
const CINZA_FAIXA: [number, number, number] = [192, 192, 192];

const LOGO_X = 27.4;
const LOGO_Y = 34.1;
const LOGO_LARGURA_MAXIMA = 58.5;
const LOGO_ALTURA_MAXIMA = 57.8;
const CENTRO_TITULOS = (86 + MARGEM_DIREITA) / 2;

const TOPO_FAIXA_SECAO = 94.8;
const ALTURA_FAIXA_SECAO = 16.6;
const ROTULO_X = 43.2;
const VALOR_X = 162;
const ESPACO_LINHA_DADOS = 10.8;
const ESPACO_ANTES_TABELA = 18;

const TOPO_TABELA_DEMAIS_PAGINAS = 102;
const LINHA_RODAPE_Y = 756.6;

export interface CampoRelatorio {
  rotulo: string;
  valor: string;
}

export interface ColunaRelatorio {
  titulo: string;
  largura?: number;
  alinhamento?: "left" | "center" | "right";
}

export interface RelatorioPadraoPdf {
  entidade: string;
  titulo: string;
  secao: { titulo: string; campos: CampoRelatorio[] };
  colunas: ColunaRelatorio[];
  linhas: string[][];
  textoSemRegistros?: string;
  nomeArquivo: string;
  logoUrl?: string;
}

function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const imagem = new Image();
    imagem.onload = () => resolver(imagem);
    imagem.onerror = () => resolver(null);
    imagem.src = url;
  });
}

function formatarDataHora(data: Date): string {
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");
  return (
    `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${data.getFullYear()} ` +
    `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`
  );
}

function linhaHorizontal(doc: jsPDF, y: number, x1: number, x2: number) {
  doc.setFillColor(0, 0, 0);
  doc.rect(x1, y, x2 - x1, ESPESSURA_LINHA, "F");
}

function desenharCabecalhoPagina(
  doc: jsPDF,
  relatorio: RelatorioPadraoPdf,
  logo: HTMLImageElement | null,
) {
  linhaHorizontal(doc, 26.7, MARGEM_ESQUERDA, 589.4);

  if (logo) {
    const escala = Math.min(
      LOGO_LARGURA_MAXIMA / logo.naturalWidth,
      LOGO_ALTURA_MAXIMA / logo.naturalHeight,
    );
    const largura = logo.naturalWidth * escala;
    const altura = logo.naturalHeight * escala;
    doc.addImage(
      logo,
      "PNG",
      LOGO_X,
      LOGO_Y + (LOGO_ALTURA_MAXIMA - altura) / 2,
      largura,
      altura,
    );
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.8);
  doc.text(relatorio.entidade.toUpperCase(), CENTRO_TITULOS, 47.3, {
    align: "center",
  });
  doc.setFontSize(12);
  doc.text(relatorio.titulo, CENTRO_TITULOS, 89.9, { align: "center" });

  linhaHorizontal(doc, 94, MARGEM_ESQUERDA, 589.4);
}

function desenharSecao(doc: jsPDF, secao: RelatorioPadraoPdf["secao"]): number {
  doc.setFillColor(...CINZA_FAIXA);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(ESPESSURA_LINHA);
  doc.rect(
    MARGEM_ESQUERDA + ESPESSURA_LINHA / 2,
    TOPO_FAIXA_SECAO + ESPESSURA_LINHA / 2,
    589.3 - MARGEM_ESQUERDA - ESPESSURA_LINHA,
    ALTURA_FAIXA_SECAO - ESPESSURA_LINHA,
    "FD",
  );

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.text(secao.titulo, 23.1, 106.5);

  let y = 121.7;
  doc.setFontSize(8);
  secao.campos.forEach((campo) => {
    const linhasValor: string[] = doc.splitTextToSize(
      campo.valor,
      589.3 - VALOR_X,
    );

    doc.setFont("helvetica", "normal");
    doc.text(campo.rotulo, ROTULO_X, y);
    doc.setFont("helvetica", "bold");
    linhasValor.forEach((linha) => {
      doc.text(linha, VALOR_X, y);
      y += ESPACO_LINHA_DADOS;
    });
  });

  return y;
}

function desenharRodapes(doc: jsPDF, identificador: string, geradoEm: Date) {
  const totalPaginas = doc.getNumberOfPages();
  const dataHora = formatarDataHora(geradoEm);

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    linhaHorizontal(doc, LINHA_RODAPE_Y, MARGEM_ESQUERDA, 591.1);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(identificador, 22.3, 766.6);
    doc.text(`Página ${pagina}`, 586.1, 771.7, { align: "right" });
    doc.setFontSize(8.2);
    doc.text(dataHora, 327.8, 771.7, { align: "center" });
  }
}

// Monta o PDF no layout dos relatórios dos sistemas da empresa (ex.: "Extrato da Guia Status")
export async function montarRelatorioPadraoPdf(
  relatorio: RelatorioPadraoPdf,
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });
  const logo = relatorio.logoUrl
    ? await carregarImagem(relatorio.logoUrl)
    : null;

  desenharCabecalhoPagina(doc, relatorio, logo);
  const fimSecao = desenharSecao(doc, relatorio.secao);

  const larguraFixa = relatorio.colunas.reduce(
    (total, coluna) => total + (coluna.largura ?? 0),
    0,
  );
  const colunasLivres = relatorio.colunas.filter((c) => !c.largura).length;
  const larguraLivre =
    colunasLivres > 0 ? (LARGURA_UTIL - larguraFixa) / colunasLivres : 0;
  const ultimaColuna = relatorio.colunas.length - 1;

  const corpo =
    relatorio.linhas.length > 0
      ? relatorio.linhas
      : [
          [
            {
              content:
                relatorio.textoSemRegistros ?? "Nenhum registro encontrado.",
              colSpan: relatorio.colunas.length,
            },
          ],
        ];

  autoTable(doc, {
    startY: fimSecao + ESPACO_ANTES_TABELA,
    margin: {
      top: TOPO_TABELA_DEMAIS_PAGINAS,
      bottom: 792 - LINHA_RODAPE_Y + 6,
      left: MARGEM_ESQUERDA,
      right: 612 - MARGEM_DIREITA,
    },
    tableWidth: LARGURA_UTIL,
    head: [relatorio.colunas.map((coluna) => coluna.titulo)],
    body: corpo,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      cellPadding: { top: 2.1, bottom: 2.15, left: 2.9, right: 2.9 },
      lineWidth: 0,
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 8.2,
      fillColor: CINZA_FAIXA,
      cellPadding: { top: 1.4, bottom: 1.4, left: 2.2, right: 2.2 },
    },
    columnStyles: Object.fromEntries(
      relatorio.colunas.map((coluna, indice) => [
        indice,
        {
          cellWidth: coluna.largura ?? larguraLivre,
          halign: coluna.alinhamento ?? "left",
        },
      ]),
    ),
    didDrawCell: (dados) => {
      if (dados.section !== "head") return;
      const { x, y, width, height } = dados.cell;

      linhaHorizontal(doc, y, x, x + width);
      linhaHorizontal(doc, y + height - ESPESSURA_LINHA, x, x + width);
      doc.setFillColor(0, 0, 0);
      if (dados.column.index === 0)
        doc.rect(x, y, ESPESSURA_LINHA, height, "F");
      if (dados.column.index === ultimaColuna)
        doc.rect(x + width - ESPESSURA_LINHA, y, ESPESSURA_LINHA, height, "F");
    },
    didDrawPage: (dados) => {
      if (dados.pageNumber > 1) desenharCabecalhoPagina(doc, relatorio, logo);
    },
  });

  desenharRodapes(doc, relatorio.titulo.replace(/\s+/g, ""), new Date());
  return doc;
}

export async function gerarRelatorioPadraoPdf(relatorio: RelatorioPadraoPdf) {
  const doc = await montarRelatorioPadraoPdf(relatorio);
  doc.save(relatorio.nomeArquivo);
}
