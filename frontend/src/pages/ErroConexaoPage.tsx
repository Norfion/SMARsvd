import logoImg from "../assets/logo-smartb.png";
import { NOME_SISTEMA } from "../constants/identificacaoSistema";

export function ErroConexaoPage() {
  return (
    <div id="pagina-erro-conexao-banco" className="login-container">
      <div className="main-logo">
        <img alt={NOME_SISTEMA} src={logoImg} />
      </div>

      <div id="card-erro-conexao" className="form erro-conexao">
        <h2 className="text-danger">
          <i className="fas fa-plug mr-2"></i>
          Sistema fora do ar
        </h2>

        <p>
          O sistema perdeu a comunicação com o seu serviço de banco de dados ou
          o servidor está temporariamente inacessível.
        </p>

        <div className="erro-conexao-orientacoes">
          <strong>O que você pode fazer:</strong>
          <ul>
            <li>Tente recarregar a página para restabelecer a conexão.</li>
            <li>
              Caso o problema persista, contacte a equipe de{" "}
              <strong>Suporte / Desenvolvimento</strong> informando a
              indisponibilidade.
            </li>
          </ul>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block login-button"
          onClick={() => window.location.reload()}
        >
          <i className="fas fa-sync"></i> Recarregar página
        </button>
      </div>
    </div>
  );
}

export default ErroConexaoPage;
