import { useState } from "react";
import type { ResultadoValidacaoLote } from "../types/validacao";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ResultadoPageProps {
  resultadoAuditoria: ResultadoValidacaoLote | null;
  onIrParaValidacao: () => void;
}

export function ResultadoPage({
  resultadoAuditoria,
  onIrParaValidacao,
}: ResultadoPageProps) {
  // Estado para controlar a visibilidade do menu suspenso de exportação
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);

  // ==========================================
  // EXPORTAÇÃO PARA CSV
  // ==========================================
  const exportarParaCsv = () => {
    if (!resultadoAuditoria) return;

    const linhas: string[] = [];

    // Metadados do Arquivo e Resumo
    linhas.push(`RELATÓRIO DE AUDITORIA - SMARsvd`);
    linhas.push(`Arquivo Analisado;${resultadoAuditoria.nomeArquivo}`);
    linhas.push(`Layout Utilizado;${resultadoAuditoria.layoutUtilizado}`);
    linhas.push(
      `Total de Documentos;${resultadoAuditoria.totalGuiasAnalisadas}`,
    );
    linhas.push(`Documentos Válidos;${resultadoAuditoria.guiasValidas}`);
    linhas.push(
      `Documentos com Inconsistências;${resultadoAuditoria.guiasComInconsistencia}`,
    );
    linhas.push(``); // Linha em branco para separação

    // Cabeçalho da Tabela
    linhas.push(
      `Localização;Campo;Valor Encontrado (Arquivo);Valor Esperado (Base de Dados);Mensagem`,
    );

    // Itens de inconsistência
    if ((resultadoAuditoria.inconsistencias?.length ?? 0) === 0) {
      linhas.push(`Nenhuma divergência detectada;;;;`);
    } else {
      (resultadoAuditoria.inconsistencias ?? []).forEach((item) => {
        const sanitizar = (txt: string) =>
          `"${(txt || "").replace(/"/g, '""')}"`;

        linhas.push(
          [
            sanitizar(item.identificadorGuia),
            sanitizar(item.campo),
            sanitizar(item.valorExtraidoPdf),
            sanitizar(item.valorEsperadoBanco),
            sanitizar(item.mensagem),
          ].join(";"),
        );
      });
    }

    // \uFEFF adiciona o Byte Order Mark (BOM) UTF-8 para que o Excel abra com acentos corretos
    const conteudoCsv = "\uFEFF" + linhas.join("\r\n");
    const blob = new Blob([conteudoCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Resultado_Auditoria_${resultadoAuditoria.nomeArquivo.replace(/\.[^/.]+$/, "")}.csv`;
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

    // Escapa caracteres especiais para evitar erros de sintaxe XML
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
        <Cell ss:StyleID="Titulo"><Data ss:Type="String">RELATÓRIO DE AUDITORIA - SMARsvd</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Arquivo Analisado:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(resultadoAuditoria.nomeArquivo)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Layout Utilizado:</Data></Cell>
        <Cell><Data ss:Type="String">${escaparXml(resultadoAuditoria.layoutUtilizado)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Total de Documentos:</Data></Cell>
        <Cell><Data ss:Type="Number">${resultadoAuditoria.totalGuiasAnalisadas}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Documentos Válidos:</Data></Cell>
        <Cell><Data ss:Type="Number">${resultadoAuditoria.guiasValidas}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Negrito"><Data ss:Type="String">Documentos com Divergências:</Data></Cell>
        <Cell><Data ss:Type="Number">${resultadoAuditoria.guiasComInconsistencia}</Data></Cell>
      </Row>
      <Row></Row>
      <Row ss:StyleID="Cabecalho">
        <Cell><Data ss:Type="String">Localização</Data></Cell>
        <Cell><Data ss:Type="String">Campo</Data></Cell>
        <Cell><Data ss:Type="String">Valor Encontrado (Arquivo)</Data></Cell>
        <Cell><Data ss:Type="String">Valor Esperado (Base de Dados)</Data></Cell>
        <Cell><Data ss:Type="String">Mensagem</Data></Cell>
      </Row>
    `;

    if ((resultadoAuditoria.inconsistencias?.length ?? 0) === 0) {
      linhasXml += `
        <Row>
          <Cell><Data ss:Type="String">Nenhuma inconsistência encontrada.</Data></Cell>
        </Row>
      `;
    } else {
      resultadoAuditoria.inconsistencias.forEach((item) => {
        linhasXml += `
          <Row>
            <Cell><Data ss:Type="String">${escaparXml(item.identificadorGuia)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.campo)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.valorExtraidoPdf)}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(item.valorEsperadoBanco)}</Data></Cell>
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
            <Column ss:Width="160"/>
            <Column ss:Width="120"/>
            <Column ss:Width="140"/>
            <Column ss:Width="150"/>
            <Column ss:Width="300"/>
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
    link.download = `Resultado_Auditoria_${resultadoAuditoria.nomeArquivo.replace(/\.[^/.]+$/, "")}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMenuExportarAberto(false);
  };

  // ==========================================
  // EXPORTAÇÃO PARA PDF (Download Direto via jsPDF)
  // ==========================================
  const exportarParaPdf = () => {
    if (!resultadoAuditoria) return;

    setMenuExportarAberto(false);

    // Cria o documento em orientação retrato (portrait), formato A4
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // 1. Cabeçalho e Título Principal
    doc.setFillColor(0, 121, 107); // Cor verde corporativa (#00796b)
    doc.rect(14, 12, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("SMARsvd — RELATÓRIO DE AUDITORIA DE DOCUMENTOS", 16, 17.5);

    // 2. Metadados do Arquivo
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 71, 79); // #37474f
    doc.text(`Arquivo Analisado: ${resultadoAuditoria.nomeArquivo}`, 14, 26);
    doc.text(`Layout Utilizado: ${resultadoAuditoria.layoutUtilizado}`, 14, 31);

    // 3. Indicadores de Resumo (Cards)
    // Box: Total
    doc.setFillColor(224, 242, 241); // #e0f2f1
    doc.roundedRect(14, 36, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 77, 64);
    doc.text("TOTAL DE DOCUMENTOS", 17, 41);
    doc.setFontSize(14);
    doc.text(String(resultadoAuditoria.totalGuiasAnalisadas), 17, 49);

    // Box: Válidos
    doc.setFillColor(232, 245, 233); // #e8f5e9
    doc.roundedRect(77, 36, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(27, 94, 32);
    doc.text("DOCUMENTOS VÁLIDOS", 80, 41);
    doc.setFontSize(14);
    doc.text(String(resultadoAuditoria.guiasValidas), 80, 49);

    // Box: Com Inconsistência
    const temErro = resultadoAuditoria.guiasComInconsistencia > 0;
    doc.setFillColor(
      temErro ? 255 : 245,
      temErro ? 235 : 245,
      temErro ? 238 : 245,
    );
    doc.roundedRect(140, 36, 56, 16, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(
      temErro ? 183 : 117,
      temErro ? 28 : 117,
      temErro ? 28 : 117,
    );
    doc.text("INCONSISTÊNCIAS", 143, 41);
    doc.setFontSize(14);
    doc.text(String(resultadoAuditoria.guiasComInconsistencia), 143, 49);

    // 4. Montagem das Linhas da Tabela
    const colunasTabela = [
      "Localização",
      "Campo",
      "Valor Encontrado",
      "Valor Esperado",
      "Mensagem",
    ];

    const dadosTabela =
      (resultadoAuditoria.inconsistencias?.length ?? 0) === 0
        ? [["—", "—", "—", "—", "Nenhuma inconsistência detectada."]]
        : (resultadoAuditoria.inconsistencias ?? []).map((item, idx) => [
            item.identificadorGuia || `Item #${idx + 1}`,
            item.campo,
            item.valorExtraidoPdf || "—",
            item.valorEsperadoBanco || "—",
            item.mensagem,
          ]);

    // 5. Renderização da Tabela via autotable com Rodapé Dinâmico
    autoTable(doc, {
      startY: 58,
      head: [colunasTabela],
      body: dadosTabela,
      theme: "grid",
      headStyles: {
        fillColor: [0, 150, 136], // #009688
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [55, 71, 79],
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold" },
        1: { cellWidth: 28, textColor: [0, 121, 107] },
        2: { cellWidth: 28, textColor: [198, 40, 40] },
        3: { cellWidth: 28, textColor: [46, 125, 50] },
        4: { cellWidth: "auto" },
      },
      styles: {
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      didDrawPage: (data) => {
        // Formata a data e hora atual no padrão DD/MM/AAAA - HH:mm
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, "0");
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const ano = agora.getFullYear();
        const horas = String(agora.getHours()).padStart(2, "0");
        const minutos = String(agora.getMinutes()).padStart(2, "0");
        const dataHoraFormatada = `${dia}/${mes}/${ano} - ${horas}:${minutos}`;

        const alturaPagina = doc.internal.pageSize.getHeight();
        const larguraPagina = doc.internal.pageSize.getWidth();

        // Linha sutil divisória no rodapé
        doc.setDrawColor(207, 216, 220); // #cfd8dc
        doc.setLineWidth(0.2);
        doc.line(14, alturaPagina - 12, larguraPagina - 14, alturaPagina - 12);

        // Texto do rodapé com a data e horário de geração
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 144, 156); // #78909c
        doc.text(`Gerado em: ${dataHoraFormatada}`, 14, alturaPagina - 7);

        // Paginação à direita (Ex: Página 1 de 1)
        doc.text(
          `Página ${data.pageNumber}`,
          larguraPagina - 14,
          alturaPagina - 7,
          { align: "right" },
        );
      },
    });

    // 6. Dispara o download direto do arquivo .pdf
    const nomeBase = resultadoAuditoria.nomeArquivo.replace(/\.[^/.]+$/, "");
    doc.save(`Resultado_Auditoria_${nomeBase}.pdf`);
  };

  // Estado neutro: nenhum carnê validado ainda
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
        <div
          style={{ fontSize: "2.5rem", marginBottom: "12px", color: "#78909c" }}
        >
          📋
        </div>
        <h2
          style={{ fontSize: "1.2rem", color: "#37474f", marginBottom: "8px" }}
        >
          Nenhuma auditoria realizada no momento
        </h2>
        <p
          style={{ color: "#607d8b", fontSize: "0.9rem", marginBottom: "20px" }}
        >
          Importe e valide um arquivo de carnê na página de Validação para
          visualizar o relatório detalhado de inconsistências.
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

      {/* CABEÇALHO DO RESULTADO */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          borderBottom: "1px solid #eceff1",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#00796b" }}>
            Resultado da Auditoria
          </h2>
          <span style={{ fontSize: "0.8rem", color: "#607d8b" }}>
            Arquivo: <strong>{resultadoAuditoria.nomeArquivo}</strong> • Layout:{" "}
            <strong>{resultadoAuditoria.layoutUtilizado}</strong>
          </span>
        </div>

        {/* ÁREA DE AÇÕES COM O BOTÃO NOVO / EXPORTAR */}
        <div
          className="area-botoes-resultado"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          {/* Menu Dropdown Exportar com hover idêntico ao Novo Layout */}
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
            {resultadoAuditoria.totalGuiasAnalisadas}
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
            {resultadoAuditoria.guiasValidas}
          </p>
        </div>

        <div
          style={{
            backgroundColor:
              resultadoAuditoria.guiasComInconsistencia > 0
                ? "#ffebee"
                : "#f5f5f5",
            border:
              resultadoAuditoria.guiasComInconsistencia > 0
                ? "1px solid #ffcdd2"
                : "1px solid #e0e0e0",
            borderRadius: "4px",
            padding: "12px",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color:
                resultadoAuditoria.guiasComInconsistencia > 0
                  ? "#b71c1c"
                  : "#757575",
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
              color:
                resultadoAuditoria.guiasComInconsistencia > 0
                  ? "#c62828"
                  : "#9e9e9e",
            }}
          >
            {resultadoAuditoria.guiasComInconsistencia}
          </p>
        </div>
      </div>

      {/* Tabela de Inconsistências / Detalhes */}
      {(resultadoAuditoria.inconsistencias?.length ?? 0) === 0 ? (
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
          Nenhuma inconsistência encontrada. Todas as regras de validação foram
          atendidas perfeitamente!
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#37474f",
                  color: "#ffffff",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "8px 10px" }}>Localização</th>
                <th style={{ padding: "8px 10px" }}>Campo</th>
                <th style={{ padding: "8px 10px" }}>
                  Valor Encontrado (Arquivo)
                </th>
                <th style={{ padding: "8px 10px" }}>
                  Valor Esperado (Base de Dados)
                </th>
                <th style={{ padding: "8px 10px" }}>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {(resultadoAuditoria.inconsistencias ?? []).map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid #eceff1",
                    backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfc",
                  }}
                >
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>
                    {item.identificadorGuia || `Item #${idx + 1}`}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: "#00796b",
                      fontWeight: 600,
                    }}
                  >
                    {item.campo}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: "#c62828",
                      fontWeight: 600,
                    }}
                  >
                    {item.valorExtraidoPdf || "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: "#2e7d32",
                      fontWeight: 600,
                    }}
                  >
                    {item.valorEsperadoBanco || "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#455a64" }}>
                    {item.mensagem}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
