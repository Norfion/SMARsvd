import { useState, useMemo } from "react";
import type {
  ResultadoValidacaoLote,
  InconsistenciaItem,
  ValidacaoDetalhadaItem,
  FalhaProcessamentoItem,
} from "../types/validacao";
import { ModalFalhasProcessamento } from "../components/ModalFalhasProcessamento";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Painel } from "../components/Painel";

ModuleRegistry.registerModules([AllCommunityModule]);

// Grid no padrão das tabelas dos sistemas da empresa (cabeçalho na cor do tema, linhas zebradas)
const TEMA_GRID = themeQuartz.withParams({
  accentColor: "#0cae89",
  fontFamily: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
  fontSize: 13,
  foregroundColor: "#333333",
  borderColor: "#dee2e6",
  borderRadius: 4,
  wrapperBorderRadius: 4,
  headerBackgroundColor: "#0cae89",
  headerTextColor: "#fafafa",
  headerFontWeight: 500,
  headerCellHoverBackgroundColor: "#27c6a2",
  headerColumnResizeHandleColor: "#fafafa",
  oddRowBackgroundColor: "#f9f9f9",
  rowHoverColor: "#c3c3c3",
  selectedRowBackgroundColor: "#d7e0e2",
});

// Cores do tema usadas nos arquivos exportados
const RGB_PRIMARIA: [number, number, number] = [12, 174, 137];
const RGB_SUCESSO: [number, number, number] = [87, 196, 69];
const RGB_ERRO: [number, number, number] = [167, 55, 43];
const RGB_NEUTRO: [number, number, number] = [110, 127, 123];
const RGB_TEXTO: [number, number, number] = [51, 51, 51];

interface ResultadoPageProps {
  resultadoAuditoria: ResultadoValidacaoLote | null;
  onIrParaValidacao: () => void;
}

interface ItemTabelaExibicao {
  pagina: string;
  campo: string;
  valorEsperado: string;
  valorExtraido: string;
  status: "OK" | "DIVERGÊNCIA";
  mensagem: string;
}

const AG_GRID_LOCALE_BR = {
  filterOoo: "Filtrar...",
  equals: "Igual a",
  notEqual: "Diferente de",
  blank: "Em branco",
  notBlank: "Não em branco",
  empty: "Escolha um",
  contains: "Contém",
  notContains: "Não contém",
  startsWith: "Começa com",
  endsWith: "Termina com",
  lessThan: "Menor que",
  lessThanOrEqual: "Menor ou igual a",
  greaterThan: "Maior que",
  greaterThanOrEqual: "Maior ou igual a",
  inRange: "No intervalo",
  andCondition: "E",
  orCondition: "OU",
  applyFilter: "Aplicar",
  resetFilter: "Limpar",
  clearFilter: "Limpar",
  cancelFilter: "Cancelar",
  page: "Página",
  more: "mais",
  to: "a",
  of: "de",
  next: "Próxima",
  last: "Última",
  first: "Primeira",
  previous: "Anterior",
  pageSizeSelectorLabel: "Itens por página:",
  sortAscending: "Ordem crescente",
  sortDescending: "Ordem decrescente",
  columns: "Colunas",
  filters: "Filtros",
  noRowsToShow: "Nenhum registro para exibir",
  loadingOoo: "Carregando...",
};

function formatarDuracao(ms: number): string {
  const totalSegundos = Math.round(ms / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const doisDigitos = (valor: number) => String(valor).padStart(2, "0");

  return `${doisDigitos(horas)} hrs ${doisDigitos(minutos)} min ${doisDigitos(segundos)} s`;
}

function converterData(valor?: string | null): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return isNaN(data.getTime()) ? null : data;
}

export function ResultadoPage({
  resultadoAuditoria,
  onIrParaValidacao,
}: ResultadoPageProps) {
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);
  const [modalFalhasAberto, setModalFalhasAberto] = useState(false);

  const nomeArquivo =
    resultadoAuditoria?.NomeArquivo ??
    resultadoAuditoria?.nomeArquivo ??
    "arquivo.pdf";
  const layoutUtilizado =
    resultadoAuditoria?.LayoutUtilizado ??
    resultadoAuditoria?.layoutUtilizado ??
    "Padrão";
  const baseDados =
    resultadoAuditoria?.BaseDados ??
    resultadoAuditoria?.baseDados ??
    "Não informada";

  const totalDocumentos =
    resultadoAuditoria?.TotalDocumentosAnalisados ??
    resultadoAuditoria?.totalDocumentosAnalisados ??
    resultadoAuditoria?.TotalGuiasAnalisadas ??
    resultadoAuditoria?.totalGuiasAnalisadas ??
    0;
  const documentosValidos =
    resultadoAuditoria?.DocumentosValidos ??
    resultadoAuditoria?.documentosValidos ??
    resultadoAuditoria?.GuiasValidas ??
    resultadoAuditoria?.guiasValidas ??
    0;
  const documentosInconsistentes =
    resultadoAuditoria?.DocumentosComInconsistencia ??
    resultadoAuditoria?.documentosComInconsistencia ??
    resultadoAuditoria?.GuiasComInconsistencia ??
    resultadoAuditoria?.guiasComInconsistencia ??
    0;

  const percentual =
    resultadoAuditoria?.PercentualAmostragem ??
    resultadoAuditoria?.percentualAmostragem ??
    100;
  const ehIntegral = percentual === 100;
  const usouOcr =
    resultadoAuditoria?.UsouOcr ?? resultadoAuditoria?.usouOcr ?? false;

  const textoAmostragemBase = ehIntegral
    ? "Validação Integral (100% do arquivo validado)"
    : `Validação por Amostragem (${percentual}% do arquivo validado)`;

  const textoAmostragem = usouOcr
    ? `${textoAmostragemBase} [Extração via OCR/IA]`
    : textoAmostragemBase;

  const dataHoraInicio = converterData(
    resultadoAuditoria?.DataHoraInicio ?? resultadoAuditoria?.dataHoraInicio,
  );
  const dataHoraFim = converterData(
    resultadoAuditoria?.DataHoraFim ?? resultadoAuditoria?.dataHoraFim,
  );
  const tempoProcessamentoMs =
    dataHoraInicio && dataHoraFim
      ? Math.max(0, dataHoraFim.getTime() - dataHoraInicio.getTime())
      : null;
  const textoTempoProcessamento =
    tempoProcessamentoMs !== null
      ? formatarDuracao(tempoProcessamentoMs)
      : "Não informado";

  const falhasProcessamento: FalhaProcessamentoItem[] =
    resultadoAuditoria?.Falhas ?? resultadoAuditoria?.falhas ?? [];

  const itensExibicao = useMemo<ItemTabelaExibicao[]>(() => {
    const listaValidacoesCompletas: ValidacaoDetalhadaItem[] =
      resultadoAuditoria?.Validacoes ?? resultadoAuditoria?.validacoes ?? [];

    const listaInconsistencias: InconsistenciaItem[] =
      resultadoAuditoria?.Inconsistencias ??
      resultadoAuditoria?.inconsistencias ??
      [];

    if (listaValidacoesCompletas.length > 0) {
      return listaValidacoesCompletas.map((val, idx) => {
        const numPagina = val.PaginaExtraido ?? val.paginaExtraido;
        const ident = val.IdentificadorGuia ?? val.identificadorGuia;
        const localizacao =
          numPagina !== undefined && numPagina !== null && numPagina > 0
            ? `${numPagina}`
            : ident
              ? ident
              : `Item #${idx + 1}`;

        const statusRaw = (val.Status ?? val.status ?? "OK").toUpperCase();
        const ehOk =
          statusRaw === "OK" ||
          statusRaw === "VALIDO" ||
          statusRaw === "VÁLIDO";

        return {
          pagina: localizacao,
          campo:
            val.CampoLayout ??
            val.campoLayout ??
            val.CampoBanco ??
            val.campoBanco ??
            "—",
          valorEsperado: val.ValorBanco ?? val.valorBanco ?? "—",
          valorExtraido: val.ValorExtraido ?? val.valorExtraido ?? "—",
          status: ehOk ? "OK" : "DIVERGÊNCIA",
          mensagem:
            val.MensagemAuditoria ??
            val.mensagemAuditoria ??
            val.Mensagem ??
            val.mensagem ??
            (ehOk ? "Regra atendida com sucesso" : "Divergência detectada"),
        };
      });
    }

    return listaInconsistencias.map((item, idx) => {
      const numPagina = item.PaginaExtraido ?? item.paginaExtraido;
      const ident = item.IdentificadorGuia ?? item.identificadorGuia;
      const localizacao =
        numPagina !== undefined && numPagina !== null && numPagina > 0
          ? `${numPagina}`
          : ident
            ? ident
            : `Item #${idx + 1}`;

      return {
        pagina: localizacao,
        campo: item.Campo ?? item.campo ?? "—",
        valorEsperado:
          item.ValorEsperadoBanco ?? item.valorEsperadoBanco ?? "—",
        valorExtraido: item.ValorExtraidoPdf ?? item.valorExtraidoPdf ?? "—",
        status: "DIVERGÊNCIA",
        mensagem:
          item.MensagemAuditoria ??
          item.mensagemAuditoria ??
          item.Mensagem ??
          item.mensagem ??
          "Divergência detectada",
      };
    });
  }, [resultadoAuditoria]);

  const definicoesColunas = useMemo<ColDef<ItemTabelaExibicao>[]>(() => {
    return [
      {
        headerName: "Página",
        field: "pagina",
        width: 130,
        sortable: true,
        sort: "asc",
        comparator: (valorA: string, valorB: string) => {
          const numA = parseInt(valorA, 10);
          const numB = parseInt(valorB, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return valorA.localeCompare(valorB);
        },
        filter: true,
        cellClass: "celula-negrito",
      },
      {
        headerName: "Campo",
        field: "campo",
        width: 170,
        sortable: true,
        filter: true,
        cellClass: "celula-campo",
      },
      {
        headerName: "Valor Esperado (Banco)",
        field: "valorEsperado",
        width: 200,
        sortable: true,
        filter: true,
        cellClass: "celula-esperado",
      },
      {
        headerName: "Valor Extraído (Arquivo)",
        field: "valorExtraido",
        width: 200,
        sortable: true,
        filter: true,
        cellClass: (params) =>
          params.data?.status === "OK" ? "celula-negrito" : "celula-divergente",
      },
      {
        headerName: "Status",
        field: "status",
        width: 140,
        sortable: true,
        filter: "agTextColumnFilter",
        cellRenderer: (params: ICellRendererParams<ItemTabelaExibicao>) => {
          const ehOk = params.value === "OK";
          return (
            <span
              className={`badge ${ehOk ? "badge-success" : "badge-danger"}`}
            >
              <i className={ehOk ? "fas fa-check" : "fas fa-times"}></i>{" "}
              {ehOk ? "OK" : "DIVERGÊNCIA"}
            </span>
          );
        },
      },
      {
        headerName: "Mensagem de Auditoria",
        field: "mensagem",
        flex: 1,
        minWidth: 260,
        sortable: true,
        filter: true,
        cellClass: (params) =>
          params.data?.status === "OK"
            ? "celula-secundaria"
            : "celula-divergente-texto",
      },
    ];
  }, []);

  const exportarParaCsv = () => {
    if (!resultadoAuditoria) return;

    const linhas: string[] = [];
    linhas.push(`RELATÓRIO DE AUDITORIA - SMARrsvp`);
    linhas.push(`Arquivo Analisado;${nomeArquivo}`);
    linhas.push(`Layout Utilizado;${layoutUtilizado}`);
    linhas.push(`Base de Dados;${baseDados}`);
    linhas.push(`Tempo de Processamento;${textoTempoProcessamento}`);
    linhas.push(`Método de Validação;${textoAmostragem}`);
    if (usouOcr) {
      linhas.push(
        `Nota Informativa;Foi utilizada extração de dados via inteligência artificial (OCR). Ela pode cometer erros e pode não ter sido 100% extraída corretamente.`,
      );
    }
    linhas.push(`Total de Documentos;${totalDocumentos}`);
    linhas.push(`Documentos Válidos;${documentosValidos}`);
    linhas.push(`Inconsistências Detectadas;${documentosInconsistentes}`);
    linhas.push(
      `Página;Campo;Valor Esperado (Banco);Valor Extraído (Arquivo);Status;Mensagem de Auditoria`,
    );

    if (itensExibicao.length === 0) {
      linhas.push(`Nenhum registro a exibir;;;;;`);
    } else {
      itensExibicao.forEach((item) => {
        const sanitizar = (txt: string) =>
          `"${(txt || "").replace(/"/g, '""')}"`;
        linhas.push(
          [
            sanitizar(item.pagina),
            sanitizar(item.campo),
            sanitizar(item.valorEsperado),
            sanitizar(item.valorExtraido),
            sanitizar(item.status),
            sanitizar(item.mensagem),
          ].join(";"),
        );
      });
    }

    const conteudoCsv = "\uFEFF" + linhas.join("\r\n");
    const blob = new Blob([conteudoCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Resultado_Auditoria_${nomeArquivo.replace(/\.[^/.]+$/, "")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMenuExportarAberto(false);
  };

  const exportarParaExcel = () => {
    if (!resultadoAuditoria) return;

    const escaparXml = (texto: string | number) => {
      return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let linhasXml = `
      <Row>
        <Cell ss:StyleID="Titulo"><Data ss:Type="String">RELATÓRIO DE AUDITORIA - SMARrsvp</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Arquivo Analisado:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(nomeArquivo)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Layout Utilizado:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(layoutUtilizado)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Base de Dados:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(baseDados)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Tempo de Processamento:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(textoTempoProcessamento)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Método de Validação:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(textoAmostragem)}</Data></Cell>
      </Row>`;

    if (usouOcr) {
      linhasXml += `
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Nota OCR/IA:</Data></Cell>
        <Cell><Data ss:Type="String">Foi utilizada extração de dados via inteligência artificial (OCR). Ela pode cometer erros e pode não ter sido 100% extraída corretamente.</Data></Cell>
      </Row>`;
    }

    linhasXml += `
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Total de Documentos:</Data></Cell>
        <Cell><Data ss:Type="Number">${totalDocumentos}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Documentos Válidos:</Data></Cell>
        <Cell><Data ss:Type="Number">${documentosValidos}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Inconsistências Detectadas:</Data></Cell>
        <Cell><Data ss:Type="Number">${documentosInconsistentes}</Data></Cell>
      </Row>
      <Row></Row>
      <Row ss:StyleID="Cabecalho">
        <Cell><Data ss:Type="String">Página</Data></Cell>
        <Cell><Data ss:Type="String">Campo</Data></Cell>
        <Cell><Data ss:Type="String">Valor Esperado (Banco)</Data></Cell>
        <Cell><Data ss:Type="String">Valor Extraído (Arquivo)</Data></Cell>
        <Cell><Data ss:Type="String">Status</Data></Cell>
        <Cell><Data ss:Type="String">Mensagem de Auditoria</Data></Cell>
      </Row>
    `;

    if (itensExibicao.length === 0) {
      linhasXml += `
        <Row>
          <Cell><Data ss:Type="String">Nenhum registro a exibir.</Data></Cell>
        </Row>
      `;
    } else {
      itensExibicao.forEach((item) => {
        linhasXml += `
          <Row>
            <Cell><Data ss:Type="String">${escaparXml(item.pagina)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.campo)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.valorEsperado)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.valorExtraido)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.status)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.mensagem)}</Data></Cell>
          </Row>
        `;
      });
    }

    const templateXml = `<?xml version="1.0"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Styles>
          <Style ss:ID="Default" ss:Name="Normal">
            <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
          </Style>
          <Style ss:ID="Titulo">
            <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0CAE89"/>
          </Style>
          <Style ss:ID="Negrito">
            <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#333333"/>
          </Style>
          <Style ss:ID="Cabecalho">
            <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#FAFAFA"/>
            <Interior ss:Color="#0CAE89" ss:Pattern="Solid"/>
          </Style>
        </Styles>
        <Worksheet ss:Name="Auditoria">
          <Table>
            <Column ss:Width="120"/>
            <Column ss:Width="130"/>
            <Column ss:Width="150"/>
            <Column ss:Width="150"/>
            <Column ss:Width="100"/>
            <Column ss:Width="280"/>
            ${linhasXml}
          </Table>
        </Worksheet>
      </Workbook>`;

    const blob = new Blob([templateXml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Resultado_Auditoria_${nomeArquivo.replace(/\.[^/.]+$/, "")}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMenuExportarAberto(false);
  };

  const exportarParaPdf = () => {
    if (!resultadoAuditoria) return;

    setMenuExportarAberto(false);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFillColor(...RGB_PRIMARIA);
    doc.rect(14, 12, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(250, 250, 250);
    doc.text("SMARrsvp — RELATÓRIO DE AUDITORIA DE DOCUMENTOS", 16, 17.5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...RGB_TEXTO);
    doc.text(`Arquivo Analisado: ${nomeArquivo}`, 14, 25);
    doc.text(`Layout Utilizado: ${layoutUtilizado}`, 14, 30);
    doc.text(`Base de Dados: ${baseDados}`, 14, 35);
    doc.text(`Tempo de Processamento: ${textoTempoProcessamento}`, 14, 40);
    doc.text(`Método: ${textoAmostragem}`, 14, 45);

    let posicaoYCards = 50;
    if (usouOcr) {
      doc.setFontSize(7.5);
      doc.setTextColor(...RGB_ERRO);
      doc.text(
        "Nota: Foi usada extração de dados via IA. A IA pode cometer erros.",
        14,
        49,
      );
      posicaoYCards = 53;
    }

    doc.setFillColor(...RGB_PRIMARIA);
    doc.roundedRect(14, posicaoYCards, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL DE DOCUMENTOS", 17, posicaoYCards + 5);
    doc.setFontSize(14);
    doc.text(String(totalDocumentos), 17, posicaoYCards + 13);

    doc.setFillColor(...RGB_SUCESSO);
    doc.roundedRect(77, posicaoYCards, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.text("DOCUMENTOS VÁLIDOS", 80, posicaoYCards + 5);
    doc.setFontSize(14);
    doc.text(String(documentosValidos), 80, posicaoYCards + 13);

    const temErro = documentosInconsistentes > 0;
    doc.setFillColor(...(temErro ? RGB_ERRO : RGB_NEUTRO));
    doc.roundedRect(140, posicaoYCards, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.text("INCONSISTÊNCIAS DETECTADAS", 143, posicaoYCards + 5);
    doc.setFontSize(14);
    doc.text(String(documentosInconsistentes), 143, posicaoYCards + 13);

    const colunasTabela = [
      "Página",
      "Campo",
      "Valor Esperado",
      "Valor Extraído",
      "Status",
      "Mensagem de Auditoria",
    ];

    const dadosTabela =
      itensExibicao.length === 0
        ? [["—", "—", "—", "—", "—", "Nenhum registro para exibir."]]
        : itensExibicao.map((item) => [
            item.pagina,
            item.campo,
            item.valorEsperado,
            item.valorExtraido,
            item.status,
            item.mensagem,
          ]);

    autoTable(doc, {
      startY: posicaoYCards + 21,
      head: [colunasTabela],
      body: dadosTabela,
      theme: "grid",
      headStyles: {
        fillColor: RGB_PRIMARIA,
        textColor: [250, 250, 250],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: RGB_TEXTO,
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: "bold" },
        1: { cellWidth: 28, textColor: RGB_PRIMARIA },
        2: { cellWidth: 28, textColor: [58, 143, 44] },
        3: { cellWidth: 28, textColor: RGB_ERRO },
        4: { cellWidth: 22, fontStyle: "bold" },
        5: { cellWidth: "auto" },
      },
      styles: {
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      didDrawPage: (data) => {
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, "0");
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const ano = agora.getFullYear();
        const horas = String(agora.getHours()).padStart(2, "0");
        const minutos = String(agora.getMinutes()).padStart(2, "0");
        const dataHoraFormatada = `${dia}/${mes}/${ano} - ${horas}:${minutos}`;

        const alturaPagina = doc.internal.pageSize.getHeight();
        const larguraPagina = doc.internal.pageSize.getWidth();

        doc.setDrawColor(204, 204, 204);
        doc.setLineWidth(0.2);
        doc.line(14, alturaPagina - 12, larguraPagina - 14, alturaPagina - 12);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...RGB_NEUTRO);
        doc.text(`Gerado em: ${dataHoraFormatada}`, 14, alturaPagina - 7);

        doc.text(
          `Página ${data.pageNumber}`,
          larguraPagina - 14,
          alturaPagina - 7,
          { align: "right" },
        );
      },
    });

    const nomeBase = nomeArquivo.replace(/\.[^/.]+$/, "");
    doc.save(`Resultado_Auditoria_${nomeBase}.pdf`);
  };

  if (!resultadoAuditoria) {
    return (
      <div className="row">
        <div className="col">
          <div className="box-form-cadastro">
            <Painel titulo="Resultado da Auditoria">
              <div id="resultado-vazio" className="resultado-vazio">
                <i className="fas fa-clipboard-list"></i>
                <h5>Nenhuma validação realizada</h5>
                <p>
                  Importe e valide um arquivo na página de Validação para
                  visualizar o relatório detalhado de inconsistências.
                </p>
                <button
                  type="button"
                  onClick={onIrParaValidacao}
                  className="btn btn-primary"
                >
                  <i className="fas fa-clipboard-check"></i> Ir para Validação
                </button>
              </div>
            </Painel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row">
      <div className="col">
        <div id="painel-resultado-auditoria" className="box-form-cadastro">
          <Painel titulo="Resultado da Auditoria">
            <div className="row">
              <div className="col-lg-9">
                <div className="row">
                  <div className="col-lg-6">
                    <label>Arquivo</label>
                    <div className="form-control is-view restrict-text-size">
                      {nomeArquivo}
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <label>Layout</label>
                    <div className="form-control is-view">
                      {layoutUtilizado}
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <label>Base de dados</label>
                    <div className="form-control is-view">{baseDados}</div>
                  </div>
                  <div className="col-lg-6">
                    <label>Tempo de processamento</label>
                    <div
                      id="info-tempo-processamento"
                      className="form-control is-view"
                    >
                      <strong>{textoTempoProcessamento}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-lg-3 area-botoes-resultado">
                {falhasProcessamento.length > 0 && (
                  <button
                    type="button"
                    id="btn-mostrar-falhas"
                    onClick={() => setModalFalhasAberto(true)}
                    className="btn btn-danger"
                  >
                    <i className="fas fa-exclamation-triangle"></i> Mostrar
                    falhas ({falhasProcessamento.length})
                  </button>
                )}

                <div
                  className="dropdown-hover"
                  onMouseEnter={() => setMenuExportarAberto(true)}
                  onMouseLeave={() => setMenuExportarAberto(false)}
                >
                  <button type="button" className="btn btn-primary">
                    <i className="fas fa-file-export"></i> Exportar{" "}
                    <i className="fas fa-caret-down"></i>
                  </button>

                  {menuExportarAberto && (
                    <div className="dropdown-menu show">
                      <a className="dropdown-item" onClick={exportarParaPdf}>
                        <i className="fas fa-file-pdf"></i>Exportar para PDF
                      </a>
                      <a className="dropdown-item" onClick={exportarParaCsv}>
                        <i className="fas fa-file-csv"></i>Exportar para CSV
                      </a>
                      <a className="dropdown-item" onClick={exportarParaExcel}>
                        <i className="fas fa-file-excel"></i>Exportar para Excel
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              id="nota-metodo-validacao"
              className={`alert alert-inline mt-3 ${ehIntegral ? "alert-info" : "alert-warning"}`}
            >
              <i
                className={
                  ehIntegral
                    ? "fas fa-info-circle"
                    : "fas fa-exclamation-triangle"
                }
              ></i>
              <div>
                <strong>Observações:</strong>
                <div>
                  {ehIntegral
                    ? "- Validação Integral: 100% dos documentos do arquivo foram auditados."
                    : `- Validação por Amostragem: Foram validados ${percentual}% dos documentos do arquivo.`}
                </div>
                {usouOcr && (
                  <div id="nota-aviso-ocr-ia">
                    - Foi utilizada extração de dados via inteligência
                    artificial (OCR). A IA pode cometer erros e, por isso, os
                    dados podem não ter sido 100% extraídos corretamente.
                  </div>
                )}
              </div>
            </div>

            <div className="row">
              <div className="col-lg-4">
                <div className="info-card">
                  <label className="info-card-titulo">
                    Total de documentos
                  </label>
                  <label className="info-card-valor">{totalDocumentos}</label>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="info-card info-card-success">
                  <label className="info-card-titulo">Documentos válidos</label>
                  <label className="info-card-valor">{documentosValidos}</label>
                </div>
              </div>
              <div className="col-lg-4">
                <div
                  className={`info-card ${documentosInconsistentes > 0 ? "info-card-danger" : "info-card-neutro"}`}
                >
                  <label className="info-card-titulo">
                    Inconsistências detectadas
                  </label>
                  <label className="info-card-valor">
                    {documentosInconsistentes}
                  </label>
                </div>
              </div>
            </div>
          </Painel>

          <Painel titulo="Detalhamento das validações">
            {itensExibicao.length === 0 ? (
              <div className="alert alert-inline alert-success justify-content-center mb-0">
                <i className="fas fa-check-circle"></i>
                Nenhum dado de validação encontrado para exibição.
              </div>
            ) : (
              <div className="grid-resultado">
                <AgGridReact<ItemTabelaExibicao>
                  theme={TEMA_GRID}
                  rowData={itensExibicao}
                  columnDefs={definicoesColunas}
                  pagination={true}
                  paginationPageSize={20}
                  paginationPageSizeSelector={[10, 20, 50, 100]}
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  initialState={{
                    filter: {
                      filterModel: {
                        status: {
                          filterType: "text",
                          type: "equals",
                          filter: "DIVERGÊNCIA",
                        },
                      },
                    },
                  }}
                  defaultColDef={{
                    resizable: true,
                    sortable: true,
                    filter: true,
                  }}
                  animateRows={true}
                  localeText={AG_GRID_LOCALE_BR}
                ></AgGridReact>
              </div>
            )}
          </Painel>
        </div>
      </div>

      <ModalFalhasProcessamento
        aberto={modalFalhasAberto}
        falhas={falhasProcessamento}
        aoFechar={() => setModalFalhasAberto(false)}
      />
    </div>
  );
}

export default ResultadoPage;
