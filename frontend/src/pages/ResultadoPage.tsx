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
  type CellStyle,
} from "ag-grid-community";

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

export function ResultadoPage({
  resultadoAuditoria,
  onIrParaValidacao,
}: ResultadoPageProps) {
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);

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
    resultadoAuditoria?.Amostragem ?? resultadoAuditoria?.amostragem ?? 100;
  const ehIntegral = percentual === 100;
  const usouOcr =
    resultadoAuditoria?.UsouOcr ?? resultadoAuditoria?.usouOcr ?? false;

  const textoAmostragemBase = ehIntegral
    ? "Validação Integral (100% do arquivo validado)"
    : `Validação por Amostragem (${percentual}% do arquivo validado)`;

  const textoAmostragem = usouOcr
    ? `${textoAmostragemBase} [Extração via OCR/IA]`
    : textoAmostragemBase;

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
    const estiloBase: CellStyle = {
      display: "flex",
      alignItems: "center",
    };

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
        cellStyle: { ...estiloBase, fontWeight: "700" },
      },
      {
        headerName: "Campo",
        field: "campo",
        width: 170,
        sortable: true,
        filter: true,
        cellStyle: {
          ...estiloBase,
          color: "var(--smar-teal-dark)",
          fontWeight: "600",
        },
      },
      {
        headerName: "Valor Esperado (Banco)",
        field: "valorEsperado",
        width: 200,
        sortable: true,
        filter: true,
        cellStyle: {
          ...estiloBase,
          color: "var(--smar-success-text)",
          fontWeight: "600",
        },
      },
      {
        headerName: "Valor Extraído (Arquivo)",
        field: "valorExtraido",
        width: 200,
        sortable: true,
        filter: true,
        cellStyle: (params) => ({
          ...estiloBase,
          color:
            params.data?.status === "OK"
              ? "var(--smar-text-primary)"
              : "var(--smar-danger-text)",
          fontWeight: "600",
        }),
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
            <div
              style={{ display: "flex", alignItems: "center", height: "100%" }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  backgroundColor: ehOk
                    ? "var(--smar-success-bg)"
                    : "var(--smar-danger-bg)",
                  color: ehOk
                    ? "var(--smar-success-text)"
                    : "var(--smar-danger-text)",
                  border: ehOk
                    ? "1px solid var(--smar-success-border)"
                    : "1px solid var(--smar-danger-border)",
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
          ...estiloBase,
          color:
            params.data?.status === "OK"
              ? "var(--smar-text-secondary)"
              : "var(--smar-danger-dark)",
        }),
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
    doc.text(`Base de Dados: ${baseDados}`, 14, 35);
    doc.text(`Método: ${textoAmostragem}`, 14, 40);

    let posicaoYCards = 45;
    if (usouOcr) {
      doc.setFontSize(7.5);
      doc.setTextColor(198, 40, 40);
      doc.text(
        "Nota: Foi usada extração de dados via IA. A IA pode cometer erros.",
        14,
        44,
      );
      posicaoYCards = 48;
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

  if (!resultadoAuditoria) {
    return (
      <div
        id="resultado-vazio"
        className="smar-card"
        style={{
          padding: "48px 24px",
          textAlign: "center",
          maxWidth: "700px",
          margin: "40px auto",
        }}
      >
        <h2
          style={{
            fontSize: "1.2rem",
            color: "var(--smar-text-body)",
            marginBottom: "8px",
          }}
        >
          Nenhuma validação realizada
        </h2>
        <p
          style={{
            color: "var(--smar-text-secondary)",
            fontSize: "0.9rem",
            marginBottom: "20px",
          }}
        >
          Importe e valide um arquivo na página de Validação para visualizar o
          relatório detalhado de inconsistências.
        </p>
        <button
          type="button"
          onClick={onIrParaValidacao}
          className="smar-btn smar-btn-primary"
          style={{ height: "36px", padding: "8px 20px" }}
        >
          <span>Ir para Validação</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="painel-resultado-auditoria"
      className="smar-card"
      style={{ padding: "20px" }}
    >
      {/* CABEÇALHO DO RESULTADO E BOTÕES */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          borderBottom: "1px solid var(--smar-border-light)",
          paddingBottom: "12px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.15rem",
              color: "var(--smar-teal-dark)",
            }}
          >
            Resultado da Auditoria
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "0.8rem",
              color: "var(--smar-text-secondary)",
              marginTop: "4px",
            }}
          >
            <span>
              Arquivo: <strong>{nomeArquivo}</strong>
            </span>
            <span>
              Layout: <strong>{layoutUtilizado}</strong>
            </span>
            <span>
              Base de Dados: <strong>{baseDados}</strong>
            </span>
          </div>
        </div>

        {/* ÁREA DE AÇÕES: EXPORTAR */}
        <div
          className="area-botoes-resultado"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setMenuExportarAberto(true)}
            onMouseLeave={() => setMenuExportarAberto(false)}
          >
            <button type="button" className="smar-btn smar-btn-primary">
              <span>Exportar</span>
              <span style={{ fontSize: "0.65rem" }}>▼</span>
            </button>

            {menuExportarAberto && (
              <div className="smar-dropdown-menu" style={{ width: "180px" }}>
                <button
                  type="button"
                  onClick={exportarParaPdf}
                  className="smar-dropdown-item"
                >
                  <span>Exportar para PDF</span>
                </button>
                <button
                  type="button"
                  onClick={exportarParaCsv}
                  className="smar-dropdown-item"
                >
                  <span>Exportar para CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportarParaExcel}
                  className="smar-dropdown-item"
                >
                  <span>Exportar para Excel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTA INFORMATIVA SOBRE O MÉTODO / AMOSTRAGEM */}
      <div
        id="nota-metodo-validacao"
        className={`smar-alert ${ehIntegral ? "smar-alert-info" : "smar-alert-warning"}`}
        style={{
          marginBottom: "16px",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <span>
          <strong>Observações:</strong>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>
            {ehIntegral
              ? "- Validação Integral: 100% dos documentos do arquivo foram auditados."
              : `- Validação por Amostragem: Foram validados ${percentual}% dos documentos do arquivo.`}
          </span>
        </div>

        {usouOcr && (
          <div
            id="nota-aviso-ocr-ia"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span>
              - Foi utilizada extração de dados via inteligência artificial
              (OCR). A IA pode cometer erros e, por isso, os dados podem não ter
              sido 100% extraídos corretamente.
            </span>
          </div>
        )}
      </div>

      {/* INDICADORES RESUMO (KPIS) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="smar-kpi-card smar-kpi-card-teal">
          <span className="smar-kpi-title">TOTAL DE DOCUMENTOS</span>
          <p className="smar-kpi-value">{totalDocumentos}</p>
        </div>

        <div className="smar-kpi-card smar-kpi-card-green">
          <span className="smar-kpi-title">DOCUMENTOS VÁLIDOS</span>
          <p className="smar-kpi-value">{documentosValidos}</p>
        </div>

        <div
          className={`smar-kpi-card ${documentosInconsistentes > 0 ? "smar-kpi-card-red" : "smar-kpi-card-gray"}`}
        >
          <span className="smar-kpi-title">INCONSISTÊNCIAS DETECTADAS</span>
          <p className="smar-kpi-value">{documentosInconsistentes}</p>
        </div>
      </div>

      {/* GRID DINÂMICO AG GRID */}
      {itensExibicao.length === 0 ? (
        <div
          className="smar-alert smar-alert-success"
          style={{ justifyContent: "center", padding: "20px", fontWeight: 600 }}
        >
          Nenhum dado de validação encontrado para exibição.
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "520px",
            border: "1px solid var(--smar-border-color)",
            borderRadius: "var(--smar-radius)",
            overflow: "hidden",
          }}
        >
          <AgGridReact<ItemTabelaExibicao>
            rowData={itensExibicao}
            columnDefs={definicoesColunas}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
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
    </div>
  );
}

export default ResultadoPage;
