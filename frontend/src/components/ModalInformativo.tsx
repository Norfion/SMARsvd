import { useEffect, useRef } from "react";
import Swal, { type SweetAlertType } from "sweetalert2";

export type TipoModalInformativo = "sucesso" | "aviso" | "erro" | "confirmacao";

interface ModalInformativoProps {
  aberto: boolean;
  tipo: TipoModalInformativo;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  exigeSenha?: boolean;
  valorSenha?: string;
  aoMudarSenha?: (novaSenha: string) => void;
  aoFechar: () => void;
  aoConfirmar?: (senha?: string) => void;
}

const TIPO_ALERTA: Record<
  Exclude<TipoModalInformativo, "confirmacao">,
  SweetAlertType
> = {
  sucesso: "success",
  aviso: "warning",
  erro: "error",
};

// Sucesso, aviso e erro usam o SweetAlert (como o window._alert dos sistemas da empresa);
// a confirmação segue o ActionValidatorModal (modal Bootstrap com "Não/Sim").
export function ModalInformativo({
  aberto,
  tipo,
  titulo,
  mensagem,
  textoConfirmar = "Sim",
  textoCancelar = "Não",
  exigeSenha = false,
  valorSenha = "",
  aoMudarSenha,
  aoFechar,
  aoConfirmar,
}: ModalInformativoProps) {
  const ehConfirmacao = tipo === "confirmacao";

  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  useEffect(() => {
    if (!aberto || tipo === "confirmacao") return;

    let ativo = true;
    Swal.fire({
      type: TIPO_ALERTA[tipo],
      titleText: titulo,
      text: mensagem,
      allowOutsideClick: false,
      customClass: { content: "swal-texto-multilinha" },
    }).then(() => {
      if (ativo) aoFecharRef.current();
    });

    return () => {
      ativo = false;
      Swal.close();
    };
  }, [aberto, tipo, titulo, mensagem]);

  useEffect(() => {
    if (!aberto || !ehConfirmacao) return;

    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFecharRef.current();
    };
    document.addEventListener("keydown", aoPressionarTecla);
    return () => document.removeEventListener("keydown", aoPressionarTecla);
  }, [aberto, ehConfirmacao]);

  if (!aberto || !ehConfirmacao) return null;

  return (
    <>
      <div className="modal-backdrop show"></div>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">
                <h3>{titulo}</h3>
              </div>
            </div>

            <div className="modal-body">
              <div style={{ whiteSpace: "pre-line" }}>{mensagem}</div>

              {exigeSenha && (
                <div className="box-form-cadastro p-0">
                  <label htmlFor="input-senha-modal">
                    Senha de confirmação
                    <span className="required-star"></span>
                  </label>
                  <input
                    id="input-senha-modal"
                    className="form-control"
                    type="password"
                    value={valorSenha}
                    onChange={(e) =>
                      aoMudarSenha && aoMudarSenha(e.target.value)
                    }
                    placeholder="Digite a senha de segurança"
                    autoFocus
                  ></input>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={aoFechar}
                style={{ marginLeft: "auto" }}
                className="btn btn-cancel"
              >
                <i className="fa fa-ban"></i> {textoCancelar}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  aoFechar();
                  if (aoConfirmar) aoConfirmar(valorSenha);
                }}
              >
                <i className="fa fa-check"></i> {textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
