import { useState, useMemo } from "react";
import type {
  ResultadoValidacaoLote,
  InconsistenciaItem,
  ValidacaoDetalhadaItem,
  FalhaProcessamentoItem,
} from "../types/validacao";
import { ModalFalhasProcessamento } from "../components/ModalFalhasProcessamento";
import type { ColDef, GridState } from "ag-grid-community";
import logoImg from "../assets/logo-smartb.png";
import { NOME_SISTEMA } from "../constants/identificacaoSistema";
import { gerarRelatorioPadraoPdf } from "../relatorios/relatorioPadraoPdf";
import { Painel } from "../components/Painel";
import { GridPadrao } from "../components/grid/GridPadrao";
import type { ItemImpressaoGrid } from "../components/grid/BarraAcoesGrid";
import {
  FiltroListaGrid,
  type ModeloFiltroLista,
  type OpcaoFiltroLista,
} from "../components/grid/FiltrosGrid";

interface ResultadoPageProps {
  resultadoAuditoria: ResultadoValidacaoLote | null;
  nomeCliente?: string;
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

const OPCOES_STATUS: OpcaoFiltroLista[] = [
  { valor: "OK", rotulo: "OK" },
  { valor: "DIVERGÊNCIA", rotulo: "DIVERGÊNCIA" },
];

const FILTRO_INICIAL_STATUS: ModeloFiltroLista = { valores: ["DIVERGÊNCIA"] };

const ESTADO_INICIAL_GRID: GridState = {
  filter: { filterModel: { status: FILTRO_INICIAL_STATUS } },
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
  nomeCliente,
  onIrParaValidacao,
}: ResultadoPageProps) {
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
        width: 110,
        sort: "asc",
        comparator: (valorA: string, valorB: string) => {
          const numA = parseInt(valorA, 10);
          const numB = parseInt(valorB, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return valorA.localeCompare(valorB);
        },
      },
      {
        headerName: "Campo",
        field: "campo",
        width: 170,
      },
      {
        headerName: "Valor Esperado (Banco)",
        field: "valorEsperado",
        width: 200,
      },
      {
        headerName: "Valor Extraído (Arquivo)",
        field: "valorExtraido",
        width: 200,
        cellClass: (params) =>
          params.data?.status === "OK" ? undefined : "celula-divergente",
      },
      {
        headerName: "Status",
        field: "status",
        width: 140,
        filter: FiltroListaGrid,
        filterParams: { opcoes: OPCOES_STATUS },
        cellClass: (params) =>
          params.value === "OK"
            ? "celula-status-ok"
            : "celula-status-divergente",
      },
      {
        headerName: "Mensagem de Auditoria",
        field: "mensagem",
        flex: 1,
        minWidth: 260,
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
  };

  const exportarParaPdf = () => {
    if (!resultadoAuditoria) return;

    const campos = [
      { rotulo: "Arquivo Analisado", valor: nomeArquivo },
      { rotulo: "Layout Utilizado", valor: layoutUtilizado },
      { rotulo: "Base de Dados", valor: baseDados },
      { rotulo: "Tempo de Processamento", valor: textoTempoProcessamento },
      { rotulo: "Método de Validação", valor: textoAmostragem },
      { rotulo: "Total de Documentos", valor: String(totalDocumentos) },
      { rotulo: "Documentos Válidos", valor: String(documentosValidos) },
      {
        rotulo: "Inconsistências Detectadas",
        valor: String(documentosInconsistentes),
      },
    ];

    if (usouOcr) {
      campos.push({
        rotulo: "Observação",
        valor:
          "Foi utilizada extração de dados via inteligência artificial (OCR). A IA pode cometer erros e os dados podem não ter sido 100% extraídos corretamente.",
      });
    }

    void gerarRelatorioPadraoPdf({
      entidade: nomeCliente ?? NOME_SISTEMA,
      titulo: "Relatório de Auditoria de Documentos",
      logoUrl: logoImg,
      secao: { titulo: "Dados da Validação", campos },
      colunas: [
        { titulo: "Página", largura: 42 },
        { titulo: "Campo", largura: 85 },
        { titulo: "Valor Esperado", largura: 100 },
        { titulo: "Valor Extraído", largura: 100 },
        { titulo: "Status", largura: 62 },
        { titulo: "Mensagem de Auditoria" },
      ],
      linhas: itensExibicao.map((item) => [
        item.pagina,
        item.campo,
        item.valorEsperado,
        item.valorExtraido,
        item.status,
        item.mensagem,
      ]),
      textoSemRegistros: "Nenhum registro para exibir.",
      nomeArquivo: `Resultado_Auditoria_${nomeArquivo.replace(/\.[^/.]+$/, "")}.pdf`,
    });
  };

  const itensImpressao: ItemImpressaoGrid[] = [
    { titulo: "XLS", icone: "fas fa-file-excel", aoClicar: exportarParaExcel },
    { titulo: "PDF", icone: "fas fa-file-pdf", aoClicar: exportarParaPdf },
    { titulo: "CSV", icone: "fas fa-file-csv", aoClicar: exportarParaCsv },
  ];

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
              <GridPadrao<ItemTabelaExibicao>
                id="grid-resultado"
                linhas={itensExibicao}
                colunas={definicoesColunas}
                estadoInicial={ESTADO_INICIAL_GRID}
                itensImpressao={itensImpressao}
              />
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
