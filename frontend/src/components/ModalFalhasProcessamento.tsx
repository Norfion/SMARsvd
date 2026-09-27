import { useMemo } from "react";
import type { FalhaProcessamentoItem } from "../types/validacao";
import { Painel } from "./Painel";

interface ModalFalhasProcessamentoProps {
  aberto: boolean;
  falhas: FalhaProcessamentoItem[];
  aoFechar: () => void;
}

interface GrupoFalha {
  chave: string;
  origem: string;
  tipo: string;
  mensagem: string;
  nomeQuery: string | null;
  paginas: string[];
  detalhes: string | null;
  datasHora: string[];
}

function agruparFalhas(falhas: FalhaProcessamentoItem[]): GrupoFalha[] {
  const grupos = new Map<string, GrupoFalha>();

  falhas.forEach((falha) => {
    const origem = falha.Origem ?? falha.origem ?? "Processo de validação";
    const tipo = falha.Tipo ?? falha.tipo ?? "Erro";
    const mensagem = falha.Mensagem ?? falha.mensagem ?? "Falha desconhecida.";
    const nomeQuery = falha.NomeQuery ?? falha.nomeQuery ?? null;
    const paginaInicio = falha.PaginaInicio ?? falha.paginaInicio;
    const paginaFim = falha.PaginaFim ?? falha.paginaFim;
    const detalhes = falha.Detalhes ?? falha.detalhes ?? null;
    const dataHora = falha.DataHora ?? falha.dataHora ?? null;

    const chave = `${origem}|${tipo}|${nomeQuery ?? ""}|${mensagem}`;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        chave,
        origem,
        tipo,
        mensagem,
        nomeQuery,
        paginas: [],
        detalhes,
        datasHora: [],
      };
      grupos.set(chave, grupo);
    }

    if (paginaInicio) {
      grupo.paginas.push(
        paginaFim && paginaFim !== paginaInicio
          ? `${paginaInicio}–${paginaFim}`
          : `${paginaInicio}`,
      );
    }
    if (dataHora) grupo.datasHora.push(dataHora);
  });

  return Array.from(grupos.values());
}

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  return isNaN(data.getTime()) ? iso : data.toLocaleString("pt-BR");
}

export function ModalFalhasProcessamento({
  aberto,
  falhas,
  aoFechar,
}: ModalFalhasProcessamentoProps) {
  const grupos = useMemo(() => agruparFalhas(falhas), [falhas]);

  if (!aberto) return null;

  return (
    <>
      <div className="modal-backdrop show"></div>
      <div
        id="modal-falhas-processamento"
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={aoFechar}
      >
        <div
          className="modal-dialog modal-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header align-items-center">
              <div className="modal-title">
                <h3>Falhas durante a validação</h3>
              </div>
              <span className="falhas-contagem">
                {falhas.length} ocorrência(s) em {grupos.length} tipo(s) de
                falha
              </span>
            </div>

            <div className="modal-body falhas-corpo">
              {grupos.map((grupo) => (
                <Painel
                  key={grupo.chave}
                  className="falha-grupo"
                  titulo={
                    <>
                      <span className="badge badge-danger mr-2">
                        {grupo.tipo}
                      </span>
                      {grupo.origem}
                    </>
                  }
                  resumo={
                    grupo.paginas.length > 1
                      ? `${grupo.paginas.length} documentos afetados`
                      : undefined
                  }
                >
                  <p className="falha-mensagem">{grupo.mensagem}</p>

                  {grupo.nomeQuery && (
                    <div>
                      Query: <strong>{grupo.nomeQuery}</strong>
                    </div>
                  )}

                  {grupo.paginas.length > 0 && (
                    <div className="falha-paginas">
                      Páginas: <strong>{grupo.paginas.join(", ")}</strong>
                    </div>
                  )}

                  {grupo.datasHora.length > 0 && (
                    <div>
                      Registrado em:{" "}
                      <strong>
                        {grupo.datasHora.map(formatarDataHora).join(", ")}
                      </strong>
                    </div>
                  )}

                  {grupo.detalhes && (
                    <details className="falha-detalhes">
                      <summary>
                        {grupo.nomeQuery
                          ? grupo.paginas.length > 1
                            ? "Ver SQL executado (exemplo do primeiro documento)"
                            : "Ver SQL executado"
                          : "Ver detalhes"}
                      </summary>
                      <pre>{grupo.detalhes}</pre>
                    </details>
                  )}
                </Painel>
              ))}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-cancel"
                onClick={aoFechar}
              >
                <i className="fa fa-times"></i> Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ModalFalhasProcessamento;
