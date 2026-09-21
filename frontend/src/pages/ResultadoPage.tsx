import { useState, useMemo } from "react";
import type {
  ResultadoValidacaoLote,
  InconsistenciaItem,
  ValidacaoDetalhadaItem,
} from "../types/validacao";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";

// Registra todos os recursos comunitários do AG Grid (filtros, ordenação, paginação)
ModuleRegistry.registerModules([AllCommunityModule]);

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

// Dicionário de tradução para os controles do AG Grid em Português (pt-BR)
const AG_GRID_LOCALE_BR = {
  // Filtros de texto
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

  // Filtros de número
  lessThan: "Menor que",
  lessThanOrEqual: "Menor ou igual a",
  greaterThan: "Maior que",
  greaterThanOrEqual: "Maior ou igual a",
  inRange: "No intervalo",

  // Condições lógicas do filtro
  andCondition: "E",
  orCondition: "OU",
  applyFilter: "Aplicar",
  resetFilter: "Limpar",
  clearFilter: "Limpar",
  cancelFilter: "Cancelar",

  // Paginação
  page: "Página",
  more: "mais",
  to: "a",
  of: "de",
  next: "Próxima",
  last: "Última",
  first: "Primeira",
  previous: "Anterior",
  pageSizeSelectorLabel: "Itens por página:",

  // Menus e ordenação
  sortAscending: "Ordem crescente",
  sortDescending: "Ordem decrescente",
  columns: "Colunas",
  filters: "Filtros",

  // Mensagens neutras
  noRowsToShow: "Nenhum registro para exibir",
  loadingOoo: "Carregando...",
};

export function ResultadoPage({
  resultadoAuditoria,
  onIrParaValidacao,
}: ResultadoPageProps) {
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);
  // Botão liga/desliga: ligado por padrão (exibe apenas divergências)
  const [apenasDivergencias, setApenasDivergencias] = useState<boolean>(true);

  // Normalizadores defensivos para aceitar PascalCase e camelCase
  const nomeArquivo =
    resultadoAuditoria?.NomeArquivo ??
    resultadoAuditoria?.nomeArquivo ??
    "arquivo.pdf";
  const layoutUtilizado =
    resultadoAuditoria?.LayoutUtilizado ??
    resultadoAuditoria?.layoutUtilizado ??
    "Padrão";

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
    resultadoAuditoria?.Amostragem ?? resultadoAuditoria?.amostragem ?? 100;
  const ehIntegral = percentual === 100;
  const usouOcr =
    resultadoAuditoria?.UsouOcr ?? resultadoAuditoria?.usouOcr ?? false;

  const listaInconsistencias: InconsistenciaItem[] =
    resultadoAuditoria?.Inconsistencias ??
    resultadoAuditoria?.inconsistencias ??
    [];

  const listaValidacoesCompletas: ValidacaoDetalhadaItem[] =
    resultadoAuditoria?.Validacoes ?? resultadoAuditoria?.validacoes ?? [];

  const textoAmostragemBase = ehIntegral
    ? "Validação Integral (100% do arquivo validado)"
    : `Validação por Amostragem (${percentual}% do arquivo validado)`;

  const textoAmostragem = usouOcr
    ? `${textoAmostragemBase} [Extração via OCR/IA]`
    : textoAmostragemBase;

  // Unifica e normaliza os itens da tabela para exibição e exportação
  const itensExibicao = useMemo<ItemTabelaExibicao[]>(() => {
    // Se estiver ligado "Exibir apenas divergências"
    if (apenasDivergencias) {
      return listaInconsistencias.map((item, idx) => {
        const numPagina = item.PaginaExtraido ?? item.paginaExtraido;
        const ident = item.IdentificadorGuia ?? item.identificadorGuia;
        const localizacao =
          numPagina !== undefined && numPagina !== null && numPagina > 0
            ? `Página ${numPagina}`
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
    }

    // Se estiver desligado, mostra todas as validações (corretas e divergentes)
    if (listaValidacoesCompletas.length > 0) {
      return listaValidacoesCompletas.map((val, idx) => {
        const numPagina = val.PaginaExtraido ?? val.paginaExtraido;
        const ident = val.IdentificadorGuia ?? val.identificadorGuia;
        const localizacao =
          numPagina !== undefined && numPagina !== null && numPagina > 0
            ? `Página ${numPagina}`
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

    // Fallback: se não houver array de validações completas na resposta, exibe as inconsistências
    return listaInconsistencias.map((item, idx) => {
      const numPagina = item.PaginaExtraido ?? item.paginaExtraido;
      const ident = item.IdentificadorGuia ?? item.identificadorGuia;
      const localizacao =
        numPagina !== undefined && numPagina !== null && numPagina > 0
          ? `Página ${numPagina}`
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
  }, [apenasDivergencias, listaInconsistencias, listaValidacoesCompletas]);

  // Definição das colunas dinâmicas para o AG Grid
  const definicoesColunas = useMemo<ColDef<ItemTabelaExibicao>[]>(() => {
    return [
      {
        headerName: "Página",
        field: "pagina",
        width: 130,
        sortable: true,
        filter: true,
        cellStyle: { fontWeight: "700", display: "flex", alignItems: "center" },
      },
      {
        headerName: "Campo",
        field: "campo",
        width: 170,
        sortable: true,
        filter: true,
        cellStyle: {
          color: "#00796b",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
        },
      },
      {
        headerName: "Valor Esperado (Banco)",
        field: "valorEsperado",
        width: 200,
        sortable: true,
        filter: true,
        cellStyle: {
          color: "#2e7d32",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
        },
      },
      {
        headerName: "Valor Extraído (Arquivo)",
        field: "valorExtraido",
        width: 200,
        sortable: true,
        filter: true,
        cellStyle: (params) => ({
          color: params.data?.status === "OK" ? "#263238" : "#c62828",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
        }),
      },
      {
        headerName: "Status",
        field: "status",
        width: 140,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<ItemTabelaExibicao>) => {
          const ehOk = params.value === "OK";
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  backgroundColor: ehOk ? "#e8f5e9" : "#ffebee",
                  color: ehOk ? "#2e7d32" : "#c62828",
                  border: ehOk ? "1px solid #c8e6c9" : "1px solid #ffcdd2",
                  lineHeight: "1.2",
                }}
              >
                {ehOk ? "OK" : "DIVERGÊNCIA"}
              </span>
            </div>
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
        cellStyle: (params) => ({
          color: params.data?.status === "OK" ? "#546e7a" : "#b71c1c",
          display: "flex",
          alignItems: "center",
        }),
      },
    ];
  }, []);

  // ==========================================
  // EXPORTAÇÃO PARA CSV
  // ==========================================
  const exportarParaCsv = () => {
    if (!resultadoAuditoria) return;

    const linhas: string[] = [];

    linhas.push(`RELATÓRIO DE AUDITORIA - SMARrsvp`);
    linhas.push(`Arquivo Analisado;${nomeArquivo}`);
    linhas.push(`Layout Utilizado;${layoutUtilizado}`);
    linhas.push(`Método de Validação;${textoAmostragem}`);
    linhas.push(
      `Modo de Exibição;${apenasDivergencias ? "Apenas Divergências" : "Todas as Validações"}`,
    );
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

  // ==========================================
  // EXPORTAÇÃO PARA EXCEL (.xls / SpreadsheetML)
  // ==========================================
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
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Método de Validação:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(textoAmostragem)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Modo de Exibição:</Data></Cell>
        <Cell><Data ss:Type="String">${apenasDivergencias ? "Apenas Divergências" : "Todas as Validações"}</Data></Cell>
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
            <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#00796b"/>
          </Style>
          <Style ss:ID="Negrito">
            <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#37474f"/>
          </Style>
          <Style ss:ID="Cabecalho">
            <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#FFFFFF"/>
            <Interior ss:Color="#00796b" ss:Pattern="Solid"/>
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

  // ==========================================
  // EXPORTAÇÃO PARA PDF
  // ==========================================
  const exportarParaPdf = () => {
    if (!resultadoAuditoria) return;

    setMenuExportarAberto(false);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFillColor(0, 121, 107);
    doc.rect(14, 12, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("SMARrsvp — RELATÓRIO DE AUDITORIA DE DOCUMENTOS", 16, 17.5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 71, 79);
    doc.text(`Arquivo Analisado: ${nomeArquivo}`, 14, 25);
    doc.text(`Layout Utilizado: ${layoutUtilizado}`, 14, 30);
    doc.text(
      `Método: ${textoAmostragem} | Modo: ${apenasDivergencias ? "Apenas Divergências" : "Todas as Validações"}`,
      14,
      35,
    );

    let posicaoYCards = 40;
    if (usouOcr) {
      doc.setFontSize(7.5);
      doc.setTextColor(198, 40, 40);
      doc.text(
        "Nota: Foi usada extração de dados via IA. A IA pode cometer erros.",
        14,
        39,
      );
      posicaoYCards = 43;
    }

    doc.setFillColor(224, 242, 241);
    doc.roundedRect(14, posicaoYCards, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 77, 64);
    doc.text("TOTAL DE DOCUMENTOS", 17, posicaoYCards + 5);
    doc.setFontSize(14);
    doc.text(String(totalDocumentos), 17, posicaoYCards + 13);

    doc.setFillColor(232, 245, 233);
    doc.roundedRect(77, posicaoYCards, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(27, 94, 32);
    doc.text("DOCUMENTOS VÁLIDOS", 80, posicaoYCards + 5);
    doc.setFontSize(14);
    doc.text(String(documentosValidos), 80, posicaoYCards + 13);

    const temErro = documentosInconsistentes > 0;
    doc.setFillColor(
      temErro ? 255 : 245,
      temErro ? 235 : 245,
      temErro ? 238 : 245,
    );
    doc.roundedRect(140, posicaoYCards, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(
      temErro ? 183 : 117,
      temErro ? 28 : 117,
      temErro ? 28 : 117,
    );
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
        fillColor: [0, 150, 136],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [55, 71, 79],
      },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: "bold" },
        1: { cellWidth: 28, textColor: [0, 121, 107] },
        2: { cellWidth: 28, textColor: [46, 125, 50] },
        3: { cellWidth: 28, textColor: [198, 40, 40] },
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

        doc.setDrawColor(207, 216, 220);
        doc.setLineWidth(0.2);
        doc.line(14, alturaPagina - 12, larguraPagina - 14, alturaPagina - 12);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 144, 156);
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

  // Estado neutro: nenhum documento validado ainda
  if (!resultadoAuditoria) {
    return (
      <div
        id="resultado-vazio"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #cfd8dc",
          borderRadius: "4px",
          padding: "48px 24px",
          textAlign: "center",
          maxWidth: "700px",
          margin: "40px auto",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{ fontSize: "1.2rem", color: "#37474f", marginBottom: "8px" }}
        >
          Nenhuma validação realizada
        </h2>
        <p
          style={{ color: "#607d8b", fontSize: "0.9rem", marginBottom: "20px" }}
        >
          Importe e valide um arquivo na página de Validação para visualizar o
          relatório detalhado de inconsistências.
        </p>
        <button
          type="button"
          onClick={onIrParaValidacao}
          style={{
            backgroundColor: "#009688",
            color: "#ffffff",
            border: "none",
            padding: "8px 20px",
            borderRadius: "4px",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          <span>Ir para Validação</span>
        </button>
      </div>
    );
  }

  // Estado com auditoria concluída
  return (
    <div
      id="painel-resultado-auditoria"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #cfd8dc",
        borderRadius: "4px",
        padding: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <style>
        {`
          @media print {
            body {
              background-color: #ffffff !important;
            }
            #cabecalho-principal-empresa,
            #barra-navegacao-fitas,
            .area-botoes-resultado {
              display: none !important;
            }
            #painel-resultado-auditoria {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
        `}
      </style>

      {/* CABEÇALHO DO RESULTADO COM TOGGLE E BOTÕES */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          borderBottom: "1px solid #eceff1",
          paddingBottom: "12px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#00796b" }}>
            Resultado da Auditoria
          </h2>
          <span style={{ fontSize: "0.8rem", color: "#607d8b" }}>
            Arquivo: <strong>{nomeArquivo}</strong> • Layout:{" "}
            <strong>{layoutUtilizado}</strong>
          </span>
        </div>

        {/* ÁREA DE AÇÕES: BOTÃO LIGA/DESLIGA + EXPORTAR */}
        <div
          className="area-botoes-resultado"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* BOTÃO LIGA / DESLIGA: "Exibir apenas divergências" */}
          <div
            id="controle-filtro-divergencias"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#f8fafc",
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid #cfd8dc",
            }}
          >
            <button
              type="button"
              id="btn-switch-apenas-divergencias"
              onClick={() => setApenasDivergencias((anterior) => !anterior)}
              style={{
                position: "relative",
                width: "38px",
                height: "20px",
                borderRadius: "10px",
                backgroundColor: apenasDivergencias ? "#00796b" : "#90a4ae",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                transition: "background-color 0.2s ease",
                display: "inline-flex",
                alignItems: "center",
              }}
              title={
                apenasDivergencias
                  ? "Clique para exibir todas as validações"
                  : "Clique para exibir apenas as divergências"
              }
            >
              <span
                style={{
                  display: "block",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  transform: apenasDivergencias
                    ? "translateX(18px)"
                    : "translateX(0px)",
                  transition: "transform 0.2s ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
              ></span>
            </button>
            <label
              htmlFor="btn-switch-apenas-divergencias"
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: apenasDivergencias ? "#00796b" : "#455a64",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              Exibir apenas divergências
            </label>
          </div>

          {/* MENU EXPORTAR */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setMenuExportarAberto(true)}
            onMouseLeave={() => setMenuExportarAberto(false)}
          >
            <button
              type="button"
              style={{
                backgroundColor: "#009688",
                color: "#ffffff",
                border: "none",
                padding: "6px 16px",
                borderRadius: "4px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: "32px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <span>Exportar</span>
              <span style={{ fontSize: "0.65rem" }}>▼</span>
            </button>

            {menuExportarAberto && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  backgroundColor: "#ffffff",
                  border: "1px solid #b0bec5",
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  zIndex: 50,
                  width: "180px",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={exportarParaPdf}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid #eceff1",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#37474f",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Exportar para PDF</span>
                </button>
                <button
                  type="button"
                  onClick={exportarParaCsv}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid #eceff1",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#37474f",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Exportar para CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportarParaExcel}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid #eceff1",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#37474f",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>Exportar para Excel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTA INFORMATIVA SOBRE O MÉTODO / AMOSTRAGEM E AVISO DE OCR/IA */}
      <div
        id="nota-metodo-validacao"
        style={{
          backgroundColor: ehIntegral ? "#e0f2f1" : "#fff8e1",
          border: ehIntegral ? "1px solid #b2dfdb" : "1px solid #ffe082",
          borderRadius: "4px",
          padding: "10px 14px",
          marginBottom: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: ehIntegral ? "#004d40" : "#6d4c41",
            lineHeight: 1.35,
          }}
        >
          <strong>Observações:</strong>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: ehIntegral ? "#004d40" : "#6d4c41",
              lineHeight: 1.35,
            }}
          >
            {ehIntegral
              ? "- Validação Integral: 100% dos documentos do arquivo foram auditados."
              : `- Validação por Amostragem: Foram validados ${percentual}% dos documentos do arquivo.`}
          </span>
        </div>

        {usouOcr && (
          <div
            id="nota-aviso-ocr-ia"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: ehIntegral ? "#004d40" : "#6d4c41",
                lineHeight: 1.35,
              }}
            >
              - Foi utilizada extração de dados via inteligência artificial
              (OCR). A IA pode cometer erros e, por isso, os dados podem não ter
              sido 100% extraídos corretamente.
            </span>
          </div>
        )}
      </div>

      {/* Indicadores Resumo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "#e0f2f1",
            border: "1px solid #b2dfdb",
            borderRadius: "4px",
            padding: "12px",
          }}
        >
          <span
            style={{ fontSize: "0.75rem", color: "#004d40", fontWeight: 700 }}
          >
            TOTAL DE DOCUMENTOS
          </span>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#00796b",
            }}
          >
            {totalDocumentos}
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#e8f5e9",
            border: "1px solid #c8e6c9",
            borderRadius: "4px",
            padding: "12px",
          }}
        >
          <span
            style={{ fontSize: "0.75rem", color: "#1b5e20", fontWeight: 700 }}
          >
            DOCUMENTOS VÁLIDOS
          </span>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#2e7d32",
            }}
          >
            {documentosValidos}
          </p>
        </div>

        <div
          style={{
            backgroundColor:
              documentosInconsistentes > 0 ? "#ffebee" : "#f5f5f5",
            border:
              documentosInconsistentes > 0
                ? "1px solid #ffcdd2"
                : "1px solid #e0e0e0",
            borderRadius: "4px",
            padding: "12px",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: documentosInconsistentes > 0 ? "#b71c1c" : "#757575",
              fontWeight: 700,
            }}
          >
            INCONSISTÊNCIAS DETECTADAS
          </span>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: documentosInconsistentes > 0 ? "#c62828" : "#9e9e9e",
            }}
          >
            {documentosInconsistentes}
          </p>
        </div>
      </div>

      {/* Grid Dinâmico AG Grid */}
      {itensExibicao.length === 0 ? (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#e8f5e9",
            borderRadius: "4px",
            border: "1px solid #c8e6c9",
            textAlign: "center",
            color: "#2e7d32",
            fontWeight: 600,
          }}
        >
          {apenasDivergencias
            ? "Nenhuma inconsistência encontrada. Todas as regras de validação foram atendidas perfeitamente!"
            : "Nenhum dado de validação encontrado para exibição."}
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "520px",
            border: "1px solid #cfd8dc",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <AgGridReact<ItemTabelaExibicao>
            rowData={itensExibicao}
            columnDefs={definicoesColunas}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
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
    </div>
  );
}

export default ResultadoPage;
