import { useEffect, useState, type ReactNode } from "react";
import logoImg from "../assets/logo-smartb.png";
import { NOME_MODULO, NOME_SISTEMA } from "../constants/identificacaoSistema";

export interface ItemMenuLateral<T extends string> {
  chave: T;
  texto: string;
  icone: string;
}

interface LayoutSistemaProps<T extends string> {
  itensMenu: ItemMenuLateral<T>[];
  itemAtivo: T;
  aoSelecionarItem: (chave: T) => void;
  aoClicarLogo?: () => void;
  aoAbrirTutorial?: () => void;
  cabecalhoPagina?: ReactNode;
  children: ReactNode;
}

// Estrutura de tela dos sistemas da empresa: cabeçalho fixo, breadcrumb, menu lateral e área de conteúdo
export function LayoutSistema<T extends string>({
  itensMenu,
  itemAtivo,
  aoSelecionarItem,
  aoClicarLogo,
  aoAbrirTutorial,
  cabecalhoPagina,
  children,
}: LayoutSistemaProps<T>) {
  const [menuRecolhido, setMenuRecolhido] = useState<boolean>(false);
  const [paginaRolada, setPaginaRolada] = useState<boolean>(false);

  useEffect(() => {
    const aoRolar = () => setPaginaRolada(window.scrollY > 0);
    window.addEventListener("scroll", aoRolar);
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  const itemSelecionado = itensMenu.find((item) => item.chave === itemAtivo);
  const alternarMenu = () => setMenuRecolhido((recolhido) => !recolhido);

  return (
    <>
      <header
        id="cabecalho-principal-empresa"
        className={`layout-header ${paginaRolada ? "header-float" : ""}`}
      >
        <div className="header-logo">
          <a onClick={aoClicarLogo}>
            <img alt={NOME_SISTEMA} src={logoImg} />
          </a>
        </div>

        {aoAbrirTutorial && (
          <div className="float-right d-inline-block mr-4 mt-3 header-acoes">
            <button
              type="button"
              id="btn-abrir-tutorial"
              className="btn btn-tutorial"
              onClick={aoAbrirTutorial}
              title="Rever o tutorial do sistema"
            >
              <i className="fas fa-question-circle"></i>
              <span>Tutorial</span>
            </button>
          </div>
        )}
      </header>

      <main className="layout-content">
        <div className="content-container">
          <div className="container container-main">
            <ul className="custom-breadcrumb">
              <li>
                <span>{NOME_SISTEMA}</span>
              </li>
              <li>
                <span>{NOME_MODULO}</span>
              </li>
              <li className="active">
                <span>{itemSelecionado?.texto}</span>
              </li>
            </ul>

            <div className="row">
              <div className="col-lg-12">
                <div className="wrapper">
                  <nav id="sidebar" className={menuRecolhido ? "active" : ""}>
                    <div className="sidemenu-scroll">
                      <ul id="barra-navegacao-fitas" className="list-unstyled">
                        {itensMenu.map((item) => (
                          <li
                            key={item.chave}
                            className={item.chave === itemAtivo ? "active" : ""}
                            onClick={() => aoSelecionarItem(item.chave)}
                          >
                            <a
                              title={item.texto}
                              role="button"
                              tabIndex={0}
                              aria-current={
                                item.chave === itemAtivo ? "page" : undefined
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  aoSelecionarItem(item.chave);
                                }
                              }}
                            >
                              <div
                                className="row"
                                style={{ flexWrap: "nowrap" }}
                              >
                                <div className="col-lg-1">
                                  <i
                                    className={`${item.icone} sidebar-icon`}
                                  ></i>
                                </div>
                                <div className="col-lg-11">
                                  <span className="sidebar-item-text">
                                    {item.texto}
                                  </span>
                                </div>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ height: "35px" }}>
                      <hr className="faded" style={{ margin: 0 }} />
                      <span
                        className={`float-right ${menuRecolhido ? "btn-collapsed" : "btn-collapse"}`}
                        title={
                          menuRecolhido ? "Expandir menu" : "Recolher menu"
                        }
                        onClick={alternarMenu}
                      >
                        <i className="fas fa-chevron-left"></i>
                      </span>
                    </div>
                  </nav>

                  <div
                    id="content"
                    style={{ marginLeft: menuRecolhido ? "40px" : "260px" }}
                  >
                    <div id="conteudo-tela-ativa" className="container">
                      {cabecalhoPagina}
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
