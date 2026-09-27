import axios from "axios";
import type { LayoutCliente } from "./types/layout";
import type { ResultadoValidacaoLote } from "./types/validacao";
import { useState, useEffect } from "react";
import { ParametrizacaoPage } from "./pages/ParametrizacaoPage";
import { ValidacaoPage } from "./pages/ValidacaoPage";
import { ResultadoPage } from "./pages/ResultadoPage";
import { layoutService } from "./services/layoutService";
import { logService } from "./services/logService";
import { ErroConexaoPage } from "./pages/ErroConexaoPage";
import { ModalInformativo } from "./components/ModalInformativo";
import { ModalLogin } from "./components/ModalLogin";
import {
  INTERVALO_HEARTBEAT_MS,
  sessaoService,
} from "./services/sessaoService";
import { tokenSessao } from "./services/tokenSessao";
import { CarregandoTela } from "./components/CarregandoTela";
import {
  LayoutSistema,
  type ItemMenuLateral,
} from "./components/LayoutSistema";
import { SlimHeader } from "./components/SlimHeader";

type AbaNavegacao = "parametrizacao" | "validacao" | "resultado";

const ITENS_MENU: ItemMenuLateral<AbaNavegacao>[] = [
  { chave: "parametrizacao", texto: "Configurações", icone: "fas fa-cogs" },
  { chave: "validacao", texto: "Validação", icone: "fas fa-clipboard-check" },
  { chave: "resultado", texto: "Resultado", icone: "fas fa-chart-bar" },
];

export function App() {
  const [usuarioLogado, setUsuarioLogado] = useState<string | null>(null);

  // Ao recarregar a página, a sessão salva na aba é revalidada antes de exibir o login
  const [verificandoSessao, setVerificandoSessao] = useState<boolean>(
    () => tokenSessao.obter() !== null,
  );

  const [modalConfirmarSaidaAberto, setModalConfirmarSaidaAberto] =
    useState<boolean>(false);

  const [abaAtiva, setAbaAtiva] = useState<AbaNavegacao>("validacao");

  // Controla se o sistema está sem comunicação com o banco de dados
  const [erroConexaoBanco, setErroConexaoBanco] = useState<boolean>(false);

  // Estado para controlar o carregamento inicial dos dados do banco
  const [carregando, setCarregando] = useState<boolean>(true);

  // Estado para armazenar o resultado da última auditoria executada
  const [resultadoAuditoria, setResultadoAuditoria] =
    useState<ResultadoValidacaoLote | null>(null);

  const [layoutsSalvos, setLayoutsSalvos] = useState<LayoutCliente[]>([]);

  // Indica se a tela de parametrização possui dados alterados e não salvos
  const [
    temAlteracoesPendentesParametrizacao,
    setTemAlteracoesPendentesParametrizacao,
  ] = useState<boolean>(false);

  // Modal para confirmar saída de tela com alterações não salvas
  const [modalAvisoNavegacaoAberto, setModalAvisoNavegacaoAberto] =
    useState<boolean>(false);
  const [abaDestinoPendente, setAbaDestinoPendente] =
    useState<AbaNavegacao | null>(null);

  // Modal para informar a conclusão com sucesso da validação
  const [modalSucessoValidacaoAberto, setModalSucessoValidacaoAberto] =
    useState<boolean>(false);

  // Escuta os eventos emitidos pelo interceptador do Axios
  useEffect(() => {
    const lidarComStatusConexao = (event: Event) => {
      const customEvent = event as CustomEvent<{ semConexao: boolean }>;
      if (customEvent.detail) {
        setErroConexaoBanco(customEvent.detail.semConexao);
      }
    };

    window.addEventListener("eventoConexaoBanco", lidarComStatusConexao);
    return () =>
      window.removeEventListener("eventoConexaoBanco", lidarComStatusConexao);
  }, []);

  useEffect(() => {
    const capturarErroGlobal = (event: ErrorEvent) => {
      logService.registrarErro({
        tipo: "Exceção",
        mensagem: event.message,
        origem: "Window Error",
        stackTrace: event.error?.stack,
        detalhes: `Arquivo: ${event.filename} | Linha: ${event.lineno}`,
      });
    };

    window.addEventListener("error", capturarErroGlobal);
    return () => window.removeEventListener("error", capturarErroGlobal);
  }, []);

  useEffect(() => {
    if (!tokenSessao.obter()) return;

    sessaoService
      .obterUsuarioAtual()
      .then(setUsuarioLogado)
      .catch(() => tokenSessao.limpar())
      .finally(() => setVerificandoSessao(false));
  }, []);

  // Descarta a sessão local e tudo que foi exibido quando o servidor deixa de aceitá-la
  useEffect(() => {
    const lidarComSessaoExpirada = () => {
      tokenSessao.limpar();
      setUsuarioLogado(null);
      setResultadoAuditoria(null);
      setLayoutsSalvos([]);
      setTemAlteracoesPendentesParametrizacao(false);
    };

    window.addEventListener("eventoSessaoExpirada", lidarComSessaoExpirada);
    return () =>
      window.removeEventListener(
        "eventoSessaoExpirada",
        lidarComSessaoExpirada,
      );
  }, []);

  // Enquanto a aba estiver aberta, o heartbeat impede que o servidor apague os dados temporários do usuário.
  // Ao fechar ou recarregar a aba, a sessão é marcada como encerrada e os dados são apagados após 5 minutos.
  useEffect(() => {
    if (!usuarioLogado) return;

    const intervaloHeartbeat = window.setInterval(() => {
      sessaoService.manterAtiva().catch(() => {});
    }, INTERVALO_HEARTBEAT_MS);

    const aoSairDaPagina = () => sessaoService.encerrar();
    window.addEventListener("pagehide", aoSairDaPagina);

    return () => {
      window.clearInterval(intervaloHeartbeat);
      window.removeEventListener("pagehide", aoSairDaPagina);
    };
  }, [usuarioLogado]);

  // Carrega os layouts salvos no banco de dados após o login
  useEffect(() => {
    if (!usuarioLogado) return;

    layoutService
      .listarTodos()
      .then((dados) => {
        if (dados && dados.length > 0) {
          setLayoutsSalvos(dados);
        }
        setErroConexaoBanco(false);
      })
      .catch((erro: unknown) => {
        console.error("Falha ao carregar layouts da API:", erro);
        const sessaoRecusada =
          axios.isAxiosError(erro) && erro.response?.status === 401;
        if (!sessaoRecusada) {
          setErroConexaoBanco(true);
        }
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [usuarioLogado]);

  const lidarComLoginConcluido = (usuario: string) => {
    setCarregando(true);
    setAbaAtiva("validacao");
    setUsuarioLogado(usuario);
  };

  const sairDoSistema = () => {
    sessaoService.encerrar();
    tokenSessao.limpar();
    setUsuarioLogado(null);
    setResultadoAuditoria(null);
    setLayoutsSalvos([]);
    setTemAlteracoesPendentesParametrizacao(false);
  };

  // Centraliza o salvamento de layouts no backend
  const lidarComSalvarLayouts = async (novosLayouts: LayoutCliente[]) => {
    setLayoutsSalvos(novosLayouts);

    const layoutParaSalvar =
      novosLayouts.find((novo) => {
        const anterior = layoutsSalvos.find(
          (l) => l.nomeModelo === novo.nomeModelo,
        );
        return !anterior || JSON.stringify(anterior) !== JSON.stringify(novo);
      }) || novosLayouts[novosLayouts.length - 1];

    if (!layoutParaSalvar) return;

    try {
      await layoutService.salvar(layoutParaSalvar);
      const dadosAtualizados = await layoutService.listarTodos();
      if (dadosAtualizados && dadosAtualizados.length > 0) {
        setLayoutsSalvos(dadosAtualizados);
      }
    } catch (erro: unknown) {
      console.error("Erro ao persistir o layout no banco de dados:", erro);
    }
  };

  const lidarComExcluirLayout = async (idParaExcluir: string) => {
    try {
      await layoutService.excluir(idParaExcluir);
      const listaAtualizada = await layoutService.listarTodos();
      setLayoutsSalvos(listaAtualizada);
    } catch (erro) {
      console.error("Erro ao excluir o layout:", erro);
    }
  };

  // Recebe o resultado da auditoria, direciona para a aba Resultado e abre o modal de sucesso
  const lidarComConclusaoValidacao = (resultado: ResultadoValidacaoLote) => {
    setResultadoAuditoria(resultado);
    setAbaAtiva("resultado");
    setModalSucessoValidacaoAberto(true);
  };

  // Controla a troca de abas com interceptação de alterações não salvas
  const tentarMudarAba = (novaAba: AbaNavegacao) => {
    if (abaAtiva === novaAba) return;

    // Se estiver na aba parametrização e houver alterações não salvas, bloqueia e avisa
    if (abaAtiva === "parametrizacao" && temAlteracoesPendentesParametrizacao) {
      setAbaDestinoPendente(novaAba);
      setModalAvisoNavegacaoAberto(true);
      return;
    }

    setAbaAtiva(novaAba);
  };

  // Caso o usuário confirme a perda das alterações para ir para outra aba
  const confirmarNavegacaoSemSalvar = () => {
    if (abaDestinoPendente) {
      setTemAlteracoesPendentesParametrizacao(false);
      setAbaAtiva(abaDestinoPendente);
      setAbaDestinoPendente(null);
    }
    setModalAvisoNavegacaoAberto(false);
  };

  if (erroConexaoBanco) {
    return <ErroConexaoPage></ErroConexaoPage>;
  }

  if (verificandoSessao) {
    return null;
  }

  if (!usuarioLogado) {
    return <ModalLogin aoAutenticar={lidarComLoginConcluido}></ModalLogin>;
  }

  const itemMenuAtivo = ITENS_MENU.find((item) => item.chave === abaAtiva);

  return (
    <div id="root-app">
      {carregando && <CarregandoTela id="overlay-bloqueio-carregamento" />}

      <LayoutSistema
        usuario={usuarioLogado}
        itensMenu={ITENS_MENU}
        itemAtivo={abaAtiva}
        aoSelecionarItem={tentarMudarAba}
        aoSair={() => setModalConfirmarSaidaAberto(true)}
        aoClicarLogo={() => tentarMudarAba("validacao")}
        cabecalhoPagina={
          <SlimHeader
            titulo={itemMenuAtivo?.texto ?? ""}
            campos={[{ titulo: "Usuário", valor: usuarioLogado }]}
          />
        }
      >
        {abaAtiva === "parametrizacao" && (
          <ParametrizacaoPage
            layoutsSalvos={layoutsSalvos}
            onSalvarLayouts={lidarComSalvarLayouts}
            onExcluirLayout={lidarComExcluirLayout}
            onHouveAlteracaoChange={setTemAlteracoesPendentesParametrizacao}
          ></ParametrizacaoPage>
        )}

        {abaAtiva === "validacao" && (
          <ValidacaoPage
            layoutsDisponiveis={layoutsSalvos}
            onConcluirValidacao={lidarComConclusaoValidacao}
          ></ValidacaoPage>
        )}

        {abaAtiva === "resultado" && (
          <ResultadoPage
            resultadoAuditoria={resultadoAuditoria}
            onIrParaValidacao={() => setAbaAtiva("validacao")}
          ></ResultadoPage>
        )}
      </LayoutSistema>

      {/* MODAL DE CONFIRMAÇÃO PARA ALTERAÇÕES NÃO SALVAS */}
      <ModalInformativo
        aberto={modalAvisoNavegacaoAberto}
        tipo="confirmacao"
        titulo="Alterações Pendentes"
        mensagem={`Existem alterações feitas no layout que não foram salvas. Essas alterações poderão ser perdidas.\n\nDeseja realmente continuar?`}
        aoConfirmar={confirmarNavegacaoSemSalvar}
        aoFechar={() => {
          setModalAvisoNavegacaoAberto(false);
          setAbaDestinoPendente(null);
        }}
      ></ModalInformativo>

      {/* MODAL DE CONFIRMAÇÃO PARA SAIR DO SISTEMA */}
      <ModalInformativo
        aberto={modalConfirmarSaidaAberto}
        tipo="confirmacao"
        titulo="Sair do Sistema"
        mensagem={`Os dados processados nesta sessão serão apagados do servidor em 5 minutos.${
          temAlteracoesPendentesParametrizacao
            ? "\n\nExistem alterações no layout que não foram salvas e serão perdidas."
            : ""
        }\n\nDeseja realmente sair?`}
        aoConfirmar={sairDoSistema}
        aoFechar={() => setModalConfirmarSaidaAberto(false)}
      ></ModalInformativo>

      {/* MODAL DE SUCESSO AO CONCLUIR VALIDAÇÃO */}
      <ModalInformativo
        aberto={modalSucessoValidacaoAberto}
        tipo="sucesso"
        titulo="Validação Concluída"
        mensagem={`A auditoria do arquivo foi finalizada.`}
        aoFechar={() => setModalSucessoValidacaoAberto(false)}
      ></ModalInformativo>
    </div>
  );
}

export default App;
