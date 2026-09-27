# SMARsvd — Validação de Documentos

O **SMARsvd** (Sistema de Validação de Documentos) é um módulo do **Sistema Tributário** que confere, de forma automática, se os carnês e guias emitidos em PDF (como IPTU, ISS, ITBI e taxas) trazem exatamente as mesmas informações que estão registradas no banco de dados da prefeitura.

Em vez de uma pessoa abrir página por página e comparar cada dado com o sistema, o SMARsvd lê o arquivo, busca as informações oficiais no banco de dados e aponta, em um relatório, tudo o que estiver diferente.

---

## Sumário

1. [Por que este sistema existe](#por-que-este-sistema-existe)
2. [O que o sistema faz, em resumo](#o-que-o-sistema-faz-em-resumo)
3. [Conceitos importantes](#conceitos-importantes)
4. [Como o sistema é usado, passo a passo](#como-o-sistema-é-usado-passo-a-passo)
5. [O que acontece por trás de uma validação](#o-que-acontece-por-trás-de-uma-validação)
6. [Como ler o resultado](#como-ler-o-resultado)
7. [Segurança e privacidade](#segurança-e-privacidade)
8. [Uso por várias pessoas ao mesmo tempo](#uso-por-várias-pessoas-ao-mesmo-tempo)
9. [Limitações e cuidados](#limitações-e-cuidados)
10. [Como o projeto está organizado](#como-o-projeto-está-organizado)
11. [Tecnologias utilizadas](#tecnologias-utilizadas)
12. [Instalação e execução (equipe técnica)](#instalação-e-execução-equipe-técnica)
13. [Configurações ajustáveis](#configurações-ajustáveis)
14. [Para quem vai contribuir com o código](#para-quem-vai-contribuir-com-o-código)

---

## Por que este sistema existe

Todos os anos as prefeituras emitem milhares de carnês e guias de cobrança. Normalmente eles são gerados em um único arquivo PDF enorme, com centenas ou milhares de páginas, que depois é enviado para a gráfica ou disponibilizado aos contribuintes.

Se algum dado sair errado nesse arquivo (um valor, um CPF, um endereço, uma inscrição), o problema só costuma aparecer depois que o documento já chegou ao contribuinte, gerando retrabalho, reclamações e até prejuízo na arrecadação.

Conferir tudo isso manualmente é lento, cansativo e sujeito a falhas. O SMARsvd foi criado para:

- **Reduzir erros** nos documentos antes que eles sejam distribuídos;
- **Economizar tempo** da equipe, que deixa de conferir página por página;
- **Dar segurança** ao processo de emissão, com um relatório que comprova o que foi conferido;
- **Funcionar com qualquer modelo de carnê**, sem precisar alterar o sistema para cada prefeitura ou tipo de documento.

---

## O que o sistema faz, em resumo

1. **Aprende o formato do documento.** Uma pessoa mostra ao sistema, uma única vez, onde fica cada informação no carnê (por exemplo: "o valor total fica neste retângulo da página 1").
2. **Lê o arquivo PDF.** Ao receber um arquivo com vários carnês, o sistema descobre onde cada carnê começa e termina e extrai as informações das áreas marcadas.
3. **Consulta o banco de dados da prefeitura.** Com os dados lidos (por exemplo, a inscrição do imóvel), o sistema busca no banco de dados quais deveriam ser os valores corretos.
4. **Compara e aponta as diferenças.** Cada informação do PDF é comparada com a do banco de dados, e o resultado é apresentado em tela.
5. **Gera relatórios.** O resultado pode ser exportado em PDF, Excel ou CSV.

---

## Conceitos importantes

Alguns termos aparecem com frequência no sistema. Entendê-los facilita muito o uso:

| Termo | O que significa |
| --- | --- |
| **Documento** | Um carnê ou guia individual, que pode ter uma ou várias páginas. |
| **Arquivo** (ou lote) | O PDF enviado para validação. Normalmente contém muitos documentos em sequência. |
| **Layout** (ou modelo) | A "receita" de leitura de um tipo de documento: onde fica cada informação e como ela deve ser conferida. Cada prefeitura pode ter vários layouts (ex.: "IPTU 2026", "ISS Fixo"). |
| **Campo** | Uma informação que o sistema deve ler no documento, marcada como um retângulo sobre a página (ex.: "Inscrição", "Valor Total"). |
| **Regra de validação** | A instrução que diz ao sistema como buscar no banco de dados o valor correto e com qual campo do documento ele deve ser comparado. |
| **Amostragem** | Opção de conferir apenas uma parte dos documentos do arquivo, escolhidos ao acaso, para obter uma resposta mais rápida. |
| **OCR** | Tecnologia que "lê" texto a partir de uma imagem. É usada automaticamente quando a página do PDF é uma imagem (um documento escaneado, por exemplo) e não tem texto selecionável. |
| **Divergência** | Uma informação do documento que não bate com a do banco de dados. |

### Os três tipos de campo

Ao marcar uma área no documento, a pessoa escolhe o que aquela área representa:

- **Identificador de documento** — um texto que aparece **apenas na primeira página de cada carnê** (por exemplo, "PREFEITURA MUNICIPAL"). É assim que o sistema sabe onde um carnê termina e o próximo começa dentro de um arquivo grande. Todo layout precisa ter um.
- **Identificador de página** — um texto que indica **que tipo de página** é aquela (por exemplo, "DEMONSTRATIVO DE DÉBITOS"). É útil quando os carnês têm quantidades diferentes de páginas: o sistema reconhece cada página pelo seu conteúdo, e não pela posição.
- **Campo comum** — a informação que será de fato **conferida** (CPF, inscrição, valor, vencimento etc.). Para esses campos também é possível informar:
  - **Tipo de dado:** texto, número inteiro, número decimal, data, CPF/CNPJ ou CEP. O sistema usa isso para separar o valor do restante do texto e avisar quando o que foi lido não tem o formato esperado.
  - **Texto anterior e texto posterior:** palavras que aparecem antes e depois do valor dentro da área marcada (por exemplo, "TOTAL:"), ajudando o sistema a isolar exatamente o dado desejado.

---

## Como o sistema é usado, passo a passo

O sistema é acessado pelo navegador e possui três telas principais, disponíveis no menu lateral: **Configurações**, **Validação** e **Resultado**.

### 1. Entrar no sistema

O acesso é feito com o **mesmo usuário e senha da rede Windows** da empresa (domínio `SMARAPD.COM.BR`). Não existe um cadastro de usuários separado.

Cada pessoa só pode ter uma sessão aberta por vez. Se o mesmo usuário tentar entrar em outro computador ou aba enquanto já estiver conectado, o sistema pede que a outra sessão seja encerrada primeiro.

### 2. Configurações — ensinar o sistema a ler um documento

Esta tela é usada para criar e manter os **layouts**. Normalmente é feita uma única vez para cada modelo de carnê, e revisada apenas quando o modelo muda.

1. **Criar um layout:** clique em **Novo** e escolha entre:
   - **Importar modelo (PDF):** envie um exemplo do carnê (até 10 páginas e 20 MB). O sistema mostra as páginas na tela e detecta sozinho o tamanho do papel.
   - **Criar manualmente:** informe as medidas da página sem usar um exemplo.
2. **Configurações do documento:** escolha a prefeitura (cliente), dê um nome ao layout e confira a largura e a altura da página.
3. **Mapeamento dos campos:** com o mouse, desenhe retângulos sobre as áreas do documento onde estão as informações. Para cada retângulo, escolha o tipo de campo, dê um nome e preencha as opções necessárias. É possível navegar entre as páginas, aproximar ou afastar a imagem e ajustar a transparência do modelo.
4. **Regras de validação:** para cada conferência desejada, escreva a consulta que busca o valor correto no banco de dados, usando os campos lidos do documento como referência (por exemplo, `$Inscricao`). Depois clique em **Analisar**: o sistema verifica se a consulta é segura e válida e mostra quais informações ela devolve. Por fim, indique qual informação do banco deve ser comparada com qual campo do documento.
5. **Salvar.** O layout fica guardado e disponível para todos os usuários.

Se a pessoa tentar sair da tela com alterações não salvas, o sistema avisa antes que elas sejam perdidas.

### 3. Validação — conferir um arquivo

1. **Conexão com o banco de dados:** informe o servidor, a porta, o nome da base de dados, o usuário e a senha do banco de dados da prefeitura. Esses dados **não são salvos** e precisam ser informados a cada validação. Recomenda-se usar um usuário que tenha apenas permissão de leitura.
2. **Importar documentos:** escolha o layout correspondente ao arquivo e selecione o PDF a ser conferido.
3. **Modo de validação:**
   - **Validar integralmente:** todos os documentos do arquivo são conferidos. É o mais seguro, mas pode demorar em arquivos grandes.
   - **Validar por amostragem:** apenas uma porcentagem dos documentos, escolhidos ao acaso, é conferida. É mais rápido, mas erros em documentos fora da amostra não serão encontrados.
4. Clique em **Validar**. A tela mostra em qual etapa o processo está. Ao final, o sistema abre automaticamente a tela de Resultado.

### 4. Resultado — analisar e exportar

A tela de Resultado apresenta:

- **Um resumo:** nome do arquivo, layout usado, base de dados consultada, tempo total de processamento e modo de validação (integral ou amostragem);
- **Três indicadores:** total de documentos analisados, documentos válidos e documentos com inconsistências;
- **Uma tabela detalhada** com cada conferência realizada: página, campo, valor esperado (banco de dados), valor encontrado (arquivo), situação (OK ou DIVERGÊNCIA) e uma mensagem explicativa. Por padrão a tabela mostra apenas as divergências, mas o filtro pode ser alterado para exibir tudo;
- **Botão "Mostrar falhas"**, que aparece quando algo impediu parte da conferência (por exemplo, uma consulta ao banco que deu erro), agrupando as ocorrências para facilitar a análise;
- **Exportação** do relatório em **PDF**, **Excel (XLS)** ou **CSV**.

---

## O que acontece por trás de uma validação

Quando o botão **Validar** é acionado, o sistema executa quatro etapas em sequência:

1. **Teste de conexão.** Antes de qualquer coisa, o sistema confirma que consegue acessar o banco de dados da prefeitura com os dados informados. Se não conseguir, o processo é interrompido e o usuário é avisado imediatamente.
2. **Leitura do arquivo.**
   - O sistema percorre todas as páginas procurando o **identificador de documento**, para descobrir onde cada carnê começa e termina.
   - Se a amostragem estiver ativa, sorteia quais documentos serão conferidos.
   - Nos documentos escolhidos, reconhece o tipo de cada página (pelos **identificadores de página**) e lê o conteúdo dos **campos comuns**.
   - A leitura é feita primeiro diretamente do texto do PDF. Somente quando a área não possui texto (por ser uma imagem) o sistema recorre ao **OCR**, que roda no próprio servidor, sem internet.
3. **Busca no banco de dados.** Para cada documento, o sistema preenche as consultas configuradas com os valores lidos e as executa no banco de dados da prefeitura. Consultas com problema não interrompem as demais: o erro é registrado e o processo continua.
4. **Comparação e relatório.** Cada valor lido do documento é comparado com o valor retornado pelo banco de dados, e o resultado final é montado e exibido.

---

## Como ler o resultado

- **OK:** o valor do documento é igual ao do banco de dados. A comparação não diferencia letras maiúsculas de minúsculas.
- **DIVERGÊNCIA:** os valores são diferentes, ou um deles não foi encontrado. A mensagem ao lado explica o motivo, por exemplo:
  - o valor lido não estava no formato esperado (uma data ilegível, um CPF incompleto etc.), mostrando também o texto que foi efetivamente lido na área;
  - o texto de referência (anterior ou identificador de página) não foi localizado;
  - o documento não retornou dados do banco.
- **Vazio/Null:** indica que não havia valor naquele lado da comparação.
- **Aviso de OCR:** quando alguma informação precisou ser lida por OCR, o relatório exibe um aviso. O OCR pode confundir caracteres em documentos de baixa qualidade, então vale conferir essas divergências com mais atenção.
- **Aviso de amostragem:** quando a validação não foi integral, o relatório deixa claro qual porcentagem dos documentos foi conferida.

---

## Segurança e privacidade

O SMARsvd lida com dados fiscais e pessoais de contribuintes, por isso foi construído com os seguintes cuidados:

- **Acesso apenas para usuários da rede da empresa**, validados diretamente no domínio Windows. A cada senha incorreta, o sistema aplica uma pequena espera para dificultar tentativas repetidas.
- **As credenciais do banco de dados da prefeitura nunca são gravadas.** Elas existem apenas durante a validação em andamento.
- **Somente consultas de leitura são permitidas.** Ao salvar um layout e antes de executar cada validação, o sistema verifica as consultas e bloqueia qualquer comando que possa alterar, apagar ou criar informações no banco de dados, ou acessar dados fora dele.
- **Nenhum dado sai do servidor.** A leitura dos documentos, inclusive por OCR, é feita localmente, sem enviar nada para serviços de internet ou nuvem.
- **Os arquivos de trabalho de cada usuário ficam separados** e são apagados automaticamente alguns minutos depois que a pessoa sai do sistema ou fecha o navegador. O próprio PDF enviado é apagado logo após a leitura.
- **Registro de erros.** Falhas inesperadas são registradas no banco de dados interno, com data, usuário e local do erro, para facilitar o suporte.

---

## Uso por várias pessoas ao mesmo tempo

A leitura de arquivos grandes exige bastante do servidor. Para garantir estabilidade, **apenas uma validação é processada por vez**.

Se uma pessoa tentar validar enquanto outra já estiver validando, o sistema avisa e pergunta se ela deseja **entrar na fila**. Ao aceitar, a tela mostra a posição na fila e a validação começa sozinha assim que chegar a vez. É possível sair da fila a qualquer momento.

Se alguém entrar na fila e fechar o navegador, o lugar é liberado automaticamente após alguns minutos, para não travar os demais.

As telas de Configurações e Resultado podem ser usadas normalmente por várias pessoas ao mesmo tempo.

---

## Limitações e cuidados

- **Amostragem não garante 100% de cobertura.** Erros em documentos que não foram sorteados não aparecem no relatório.
- **O OCR pode errar**, principalmente em documentos escaneados com baixa qualidade, manchas ou letras muito pequenas.
- **Apenas bancos de dados SQL Server** são suportados no momento.
- **O layout precisa corresponder ao arquivo.** Se o modelo do carnê mudar (posição dos dados, textos de referência), o layout deve ser ajustado na tela de Configurações.
- **A leitura por OCR considera páginas em tamanho A4** (retrato ou paisagem).
- **O modelo de referência** importado na tela de Configurações aceita no máximo 10 páginas e 20 MB. O arquivo a ser validado não tem esse limite.
- **O login com a rede Windows só funciona quando o servidor do sistema está em um computador Windows** ligado ao domínio da empresa.
- **Reiniciar o servidor desconecta todos os usuários**, que precisarão entrar novamente.
- **Os resultados não ficam guardados.** Para manter um registro de uma validação, exporte o relatório antes de sair do sistema.

---

## Como o projeto está organizado

O sistema é dividido em duas grandes partes que conversam entre si:

- **Interface (frontend):** as telas que o usuário vê e usa no navegador.
- **Servidor (backend):** a parte que fica "nos bastidores", responsável por ler os PDFs, consultar os bancos de dados, fazer as comparações e guardar os layouts.

```text
SMARsvd/
├── frontend/                     Telas do sistema, acessadas pelo navegador
│   └── src/
│       ├── pages/                As telas principais: Configurações, Validação e Resultado
│       ├── components/           Peças reaproveitadas nas telas (tabelas, janelas de aviso, login, menu)
│       ├── services/             Comunicação das telas com o servidor
│       ├── relatorios/           Geração do relatório em PDF
│       └── styles/               Aparência visual (cores, fontes, espaçamentos)
│
├── backend/                      Servidor do sistema
│   ├── SMARsvd.API/              "Porta de entrada": recebe os pedidos das telas e devolve as respostas
│   ├── SMARsvd.Application/      Regras do processo: leitura dos documentos, montagem das consultas e comparação
│   ├── SMARsvd.Domain/           Definição do que é um layout, um campo, uma regra etc.
│   ├── SMARsvd.Infrastructure/   Parte técnica: leitura de PDF, OCR, acesso a bancos de dados, login na rede
│   └── SMARsvd.IA/               Arquivo de aprendizado do OCR para a língua portuguesa
│
├── database/                     Banco de dados interno (layouts e registros de erro)
│   └── temp/                     Arquivos de trabalho temporários de cada usuário (apagados automaticamente)
│
└── tests/                        Arquivos PDF de exemplo para testes (uso local, não enviados ao repositório)
```

### Onde as informações ficam guardadas

| O quê | Onde | Por quanto tempo |
| --- | --- | --- |
| Layouts (modelos, campos, regras e imagens de referência) | Banco de dados interno do SMARsvd (`database/`) | Até serem removidos na tela de Configurações |
| Registros de erros do sistema | Banco de dados interno do SMARsvd | Permanente |
| Arquivos de trabalho de uma validação | Pasta temporária de cada usuário (`database/temp/`) | Apagados alguns minutos após o usuário sair |
| PDF enviado para validação | Pasta temporária do usuário | Apagado logo após a leitura |
| Credenciais do banco da prefeitura | Apenas na memória, durante a validação | Não são guardadas |
| Dados dos contribuintes | Banco de dados da prefeitura (apenas consultado) | O SMARsvd não altera nem copia esse banco |

---

## Tecnologias utilizadas

Para quem tiver curiosidade ou precisar dar manutenção:

- **Interface:** React com TypeScript, Vite, Bootstrap 4, AG Grid (tabelas), jsPDF (relatórios em PDF) e PDF.js (exibição do modelo de referência).
- **Servidor:** C# com .NET 6 (ASP.NET Core).
- **Banco de dados interno:** SQLite, acessado pelo Entity Framework Core.
- **Leitura de PDF:** PdfPig (texto) e Docnet (conversão de páginas em imagem).
- **OCR:** Tesseract, com o modelo de língua portuguesa, rodando localmente, e ImageSharp para tratar as imagens antes da leitura.
- **Banco de dados das prefeituras:** SQL Server, com verificação das consultas pelo analisador oficial da Microsoft (ScriptDom).

---

## Instalação e execução (equipe técnica)

### O que é preciso ter instalado

- **Windows** ligado ao domínio da empresa (necessário para o login).
- **.NET SDK 6.0** (a versão exata está definida no arquivo `global.json`).
- **Node.js 20.19 ou superior** (recomendado a versão 22 LTS).
- Ferramenta de banco de dados do .NET, instalada uma única vez:

```bash
dotnet tool install --global dotnet-ef --version 6.0.36
```

O arquivo de aprendizado do OCR (`backend/SMARsvd.IA/Models/OCR/tessdata/por.traineddata`) já acompanha o repositório. Caso precise baixá-lo novamente, ele está disponível no [repositório oficial do Tesseract](https://github.com/tesseract-ocr/tessdata_fast/raw/main/por.traineddata).

### Primeira instalação

```bash
git clone https://github.com/Norfion/SMARsvd.git
cd SMARsvd

# Prepara o servidor e cria o banco de dados interno
cd backend/SMARsvd.API
dotnet restore
dotnet ef database update --project ../SMARsvd.Infrastructure

# Prepara a interface
cd ../../frontend
npm install
```

O banco de dados interno não é enviado ao repositório. O comando `dotnet ef database update` cria o arquivo `database/SMARtb_SVD_dados.db` e deve ser executado novamente sempre que houver mudanças na estrutura do banco.

### Colocando o sistema no ar

São necessários dois terminais, um para cada parte:

**Servidor:**

```bash
cd backend/SMARsvd.API
dotnet run
```

O servidor fica disponível em `http://localhost:5224`. Em ambiente de desenvolvimento, a documentação técnica dos serviços pode ser consultada em `http://localhost:5224/swagger`.

**Interface:**

```bash
cd frontend
npm run dev
```

A interface fica disponível em `http://localhost:5173` e também é compartilhada na rede interna (VPN) pelo endereço exibido no terminal. A interface repassa automaticamente os pedidos para o servidor.

---

## Configurações ajustáveis

O arquivo `backend/SMARsvd.API/appsettings.json` permite ajustar o comportamento do servidor sem alterar o código:

| Configuração | Para que serve | Valor padrão |
| --- | --- | --- |
| `ConnectionStrings:DefaultConnection` | Localização do banco de dados interno | `database/SMARtb_SVD_dados.db` |
| `Autenticacao:Dominio` | Domínio da rede Windows usado no login | `SMARAPD.COM.BR` |
| `DadosTemporarios:MinutosRetencaoAposSaida` | Quantos minutos os arquivos de trabalho são mantidos após o usuário sair | `3` |
| `OCR:Enabled` | Liga ou desliga a leitura por OCR | `true` |
| `OCR:ModelPath` | Pasta do arquivo de aprendizado do OCR | `SMARsvd.IA/Models/OCR/tessdata` |
| `OCR:Language` | Idioma usado pelo OCR | `por` (português) |
| `OCR:UsePreProcessing` | Melhora a imagem (contraste e nitidez) antes do OCR | `true` |
| `OCR:MaximoParalelismo` | Quantas áreas o OCR lê ao mesmo tempo (opcional; quanto maior, mais memória é usada) | Metade dos processadores, entre 1 e 4 |

---

## Para quem vai contribuir com o código

- **Nomes em português:** telas, variáveis, funções e mensagens seguem o português, acompanhando o restante do código.
- **Tags sempre fechadas:** nas telas, todas as tags devem ter fechamento explícito (ex.: `<input></input>`, `<button></button>`).
- **Alterações pontuais:** prefira modificar apenas o necessário, sem reescrever arquivos inteiros sem motivo.
- **Estrutura do banco interno:** qualquer mudança nas entidades do servidor deve vir acompanhada de uma nova *migration* do Entity Framework (pasta `backend/SMARsvd.Infrastructure/Migrations`).
