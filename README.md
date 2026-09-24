# SMARsvd — Sistema Corporativo de Auditoria e Validação de Carnês

O **SMARsvd** é uma solução corporativa de alta performance desenvolvida para automação de processos de importação, identificação dinâmica, extração textual (digital e via OCR local) e auditoria relacional de carnês fiscais e tributários (como IPTU, ISS, ITBI e Taxas) em formato PDF.

O sistema opera orientado a templates versionáveis (_Layouts_), desacoplando a lógica de extração do código-fonte e viabilizando o processamento de lotes com milhares de páginas por meio de amostragem configurável e validação assíncrona contra bases legadas.

---

## 📑 Tabela de Conteúdos

1. [Visão Geral e Arquitetura](#-visão-geral-e-arquitetura)
2. [Stack Tecnológica](#-stack-tecnológica)
3. [Estrutura do Projeto](#-estrutura-do-projeto)
4. [Fluxo de Processamento e Regras de Negócio](#-fluxo-de-processamento-e-regras-de-negócio)
5. [Mecanismo de OCR Local](#-mecanismo-de-ocr-local)
6. [Auditoria e Integração SQL Server](#-auditoria-e-integração-sql-server)
7. [Pré-requisitos e Dependências](#-pré-requisitos-e-dependências)
8. [Instalação e Configuração](#-instalação-e-configuração)
9. [Execução do Projeto](#-execução-do-projeto)
10. [Convenções de Código e Versionamento](#-convenções-de-código-e-versionamento)

---

## 🏛 Visão Geral e Arquitetura

O backend segue os preceitos de **Clean Architecture** e princípios **SOLID**, assegurando testabilidade, manutenibilidade e baixo acoplamento:

- **SMARsvd.Domain:** Entidades puras, enumerações de domínio e regras de integridade de negócio sem dependências de frameworks externos.
- **SMARsvd.Application:** Casos de uso, orquestração de extração e auditoria, interfaces contratuais e DTOs estruturados.
- **SMARsvd.Infrastructure:** Implementações técnicas de persistência (EF Core/SQLite interno), leitura de PDF (PdfPig), renderização/rasterização (Docnet.Core), manipulação de imagens (SixLabors.ImageSharp), motor de visão computacional (Tesseract) e clientes ADO.NET (Microsoft.Data.SqlClient).
- **SMARsvd.API:** Controladores RESTful, injeção de dependência, configuração de middlewares globais de exceção/log e documentação via OpenAPI/Swagger.
- **Frontend (SPA):** Interface reativa em React + TypeScript construída com Vite, orientada a componentes modulares, consumo tipado de APIs e fechamento estrito de tags HTML.

```text
                                  ┌───────────────────────────────┐
                                  │      Frontend (React/Vite)    │
                                  └──────────────┬────────────────┘
                                                 │ HTTP REST
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SMARsvd.API (ASP.NET Core Web API)                                                             │
│   ├── ExceptionHandlingMiddleware                                                              │
│   ├── LayoutsController                                                                        │
│   └── ProcessamentoController                                                                  │
└───────────────────────┬────────────────────────────────────────┬───────────────────────────────┘
                        │                                        │
                        ▼                                        ▼
┌──────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│ SMARsvd.Application                          │ │ SMARsvd.Infrastructure                        │
│   ├── DTOs (Layouts, Processamento, Logs)    │ │   ├── SMARsvdDbContext (SQLite Interno)       │
│   ├── Interfaces (IExtratorPdf, IOcr, ...)   │ │   ├── ExtratorPdfService (PdfPig)             │
│   ├── ProcessadorCarnesService               │ │   ├── OcrService (Docnet.Core + Tesseract)    │
│   └── AuditoriaValidacaoService              │ │   └── SqlServerExecutorService (ADO.NET)      │
└───────────────────────┬──────────────────────┘ └───────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│ SMARsvd.Domain                               │
│   ├── Entities (LayoutCliente, RegiaoCampo)  │
│   └── Enums (TipoClassificacaoCampo, ...)    │
└──────────────────────────────────────────────┘
```

---

## 🛠 Stack Tecnológica

### Backend

- **Linguagem & Runtime:** C# / .NET 6+ (com suporte a .NET 8 / .NET 10)
- **Framework:** ASP.NET Core Web API
- **ORM:** Entity Framework Core (SQLite para configurações locais de templates e logs do sistema)
- **Extração Digital de PDF:** `UglyToad.PdfPig`
- **Processamento de Imagem & OCR:** `Docnet.Core`, `SixLabors.ImageSharp` e `Tesseract`
- **Acesso a Dados Legados:** `Microsoft.Data.SqlClient` (ADO.NET com comandos parametrizados)
- **Documentação de API:** Swashbuckle / Swagger

### Frontend

- **Runtime & Bundler:** Node.js / Vite
- **Biblioteca Base:** React 18+ com TypeScript
- **Comunicação HTTP:** Axios (com interceptadores globais de ciclo de vida e conectividade)
- **Interface:** CSS modularizado com tokens corporativos SMAR

---

## 📂 Estrutura do Projeto

```text
SMARsvd/
├── database/
│   ├── SMARtb_SVD_dados.db        # Base relacional local da aplicação
│   └── temp/                      # Arquivos transitórios de lotes e JSONs intermediários
│
├── SMARsvd.IA/
│   └── Models/
│       └── OCR/
│           └── tessdata/
│               └── por.traineddata  # Modelo offline do Tesseract para Português
│
├── backend/
│   ├── SMARsvd.sln
│   ├── SMARsvd.Domain/            # Entidades, Enums e Interfaces puras
│   │   ├── Entities/
│   │   │   ├── LayoutCliente.cs
│   │   │   ├── RegiaoCampo.cs
│   │   │   ├── QueryValidacao.cs
│   │   │   └── LogSistema.cs
│   │   └── Enums/
│   │       └── TipoClassificacaoCampo.cs
│   │
│   ├── SMARsvd.Application/       # Casos de uso e regras operacionais
│   │   ├── DTOs/
│   │   │   ├── Layouts/
│   │   │   └── Processamento/
│   │   ├── Interfaces/
│   │   └── Services/
│   │       ├── ProcessadorCarnesService.cs
│   │       └── AuditoriaValidacaoService.cs
│   │
│   ├── SMARsvd.Infrastructure/    # Implementação de persistência e serviços externos
│   │   ├── Data/
│   │   │   └── SMARsvdDbContext.cs
│   │   ├── Migrations/
│   │   └── Services/
│   │       ├── ExtratorPdfService.cs
│   │       ├── OcrService.cs
│   │       └── SqlServerExecutorService.cs
│   │
│   └── SMARsvd.API/               # Camada de entrada REST
│       ├── Controllers/
│       │   ├── LayoutsController.cs
│       │   ├── ProcessamentoController.cs
│       │   └── LogsController.cs
│       ├── Middlewares/
│       │   └── ExceptionHandlingMiddleware.cs
│       ├── appsettings.json
│       └── Program.cs
│
└── frontend/                      # Aplicação React
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── components/            # Modais, barras de progresso, botões padronizados
    │   ├── pages/
    │   │   ├── ParametrizacaoPage.tsx  # Editor de templates, canvas e coordenadas
    │   │   ├── ValidacaoPage.tsx       # Importação de arquivos e orquestração de etapas
    │   │   └── ResultadoPage.tsx       # Tabela de inconsistências e exportações
    │   ├── services/
    │   │   ├── api.ts
    │   │   ├── layoutService.ts
    │   │   └── processamentoService.ts
    │   ├── types/
    │   │   ├── layout.ts
    │   │   └── validacao.ts
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 🔄 Fluxo de Processamento e Regras de Negócio

O processamento divide-se em 3 etapas sequenciais e orquestradas:

```text
[PDF Upload]
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Etapa 1: Delimitação e Extração                                        │
│  1.1 Varredura de páginas buscando 'IdentificadorDocumento'            │
│  1.2 Determinação dos intervalos físicos (Início e Fim de cada carnê)  │
│  1.3 Aplicação do cálculo de amostragem determinística (Math.Ceiling)  │
│  1.4 Classificação do tipo de página via 'IdentificadorPagina'         │
│  1.5 Extração de texto por coordenada (vetorial com fallback para OCR) │
│  1.6 Aplicação de delimitadores via 'IdentificadorAnterior'            │
│  1.7 Emissão de 'resultado_extracao.json'                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Etapa 2: Integração e Leitura de Dados                                 │
│  2.1 Mapeamento de variáveis nas queries dinâmicas (ex.: ${CRC})       │
│  2.2 Conexão pontual em memória ao banco da entidade fiscal            │
│  2.3 Execução de consultas e retorno bruto em 'queries_retornos.json'  │
│  2.4 Consolidação em mapa plano 'dados_banco.json'                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Etapa 3: Auditoria e Relatório                                         │
│  3.1 Confronto de operadores relacionais (=, <>, >, <, contém)         │
│  3.2 Geração do laudo de divergências em 'resultado_auditoria.json'    │
│  3.3 Apresentação em tela com indicação visual de status e avisos OCR  │
└────────────────────────────────────────────────────────────────────────┘
```

### Classificação Exclusiva dos Campos

Para suportar documentos com quantidades variáveis de páginas (quebras dinâmicas por listas de débitos), os campos são cadastrados sob a enumeração `TipoClassificacaoCampo`:

1. **Nenhum (Campo de Dado Normal):** Dado a ser auditado (ex.: CPF, Inscrição, Valor Total). Vincula-se a uma página lógica previamente identificada.
2. **IdentificadorDocumento:** Determina a folha inicial de um carnê dentro de um arquivo consolidado com múltiplos documentos.
3. **IdentificadorPagina:** Âncora estrutural que classifica uma folha (ex.: folha de "Identificação", folha de "Débitos").

---

## 👁 Mecanismo de OCR Local

Para garantir conformidade com normas de privacidade e sigilo fiscal, o SMARsvd opera **sem dependência de APIs em nuvem**:

- **Estratégia de Recorte (_Crop-first_):** A página rasterizada não é lida por completo. Apenas a região delimitada em milímetros ($X, Y, Largura, Altura$) é convertida para resolução tipográfica em memória e enviada ao motor.
- **Isolamento de Memória:** O motor `TesseractEngine` é mantido em ciclo singleton ou reutilizado entre lotes, evitando sobrecarga de Garbage Collection e I/O de disco.
- **Aviso de Transparência:** Quando ao menos um dado do documento depende de processamento neural/OCR, a interface alerta o usuário sobre a possibilidade de inconsistências residuais decorrentes de qualidade de digitalização.

---

## ⚖ Auditoria e Integração SQL Server

- **Segurança de Credenciais:** As configurações de acesso à base do cliente (servidor, usuário, senha, catálogo) trafegam estritamente em memória na requisição, sem gravação no disco ou persistência interna.
- **Resiliência a Falhas:** Consultas inválidas ou erros individuais de banco não encerram o processamento em lote; o laudo registra a falha individualmente no relatório técnico, permitindo a continuidade dos demais registros.

---

## 📦 Pré-requisitos e Dependências

- **.NET SDK:** Versão 6.0, 8.0 ou 10.0 instalada.
- **Node.js:** Versão 18.x ou superior.
- **Tesseract Language Data:** Arquivo `por.traineddata` devidamente alocado em `SMARsvd.IA/Models/OCR/tessdata/`.
- **Banco de Dados Local:** O SQLite é provisionado e configurado automaticamente pela aplicação.

---

## 🚀 Instalação e Configuração

### 1. Clonando o Repositório

```bash
git clone https://github.com/seu-usuario/SMARsvd.git
cd SMARsvd
```

### 2. Configurando o Modelo de OCR

Certifique-se de que o modelo treinado para português foi baixado e posicionado:

```bash
# Estrutura esperada:
# SMARsvd/SMARsvd.IA/Models/OCR/tessdata/por.traineddata
```

Caso necessite obter o arquivo de dados rápidos oficial:
[Download por.traineddata (Tesseract Fast)](https://github.com/tesseract-ocr/tessdata_fast/raw/main/por.traineddata)

### 3. Configuração do Backend

No arquivo `backend/SMARsvd.API/appsettings.json`, confirme as diretivas de caminho:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=../../database/SMARtb_SVD_dados.db"
  },
  "OCR": {
    "Enabled": true,
    "ModelPath": "../../SMARsvd.IA/Models/OCR/tessdata",
    "Language": "por",
    "UsePreProcessing": true
  }
}
```

Restaure os pacotes e aplique as migrações:

```bash
cd backend
dotnet restore
cd SMARsvd.API
dotnet ef database update --project ../SMARsvd.Infrastructure
```

### 4. Instalação das Dependências do Frontend

```bash
cd ../../frontend
npm install
```

---

## 💻 Execução do Projeto

Para executar a solução completa em ambiente de desenvolvimento:

### Backend (.NET Web API)

```bash
cd backend/SMARsvd.API
dotnet run
```

- API disponível em: `http://localhost:5224` (ou porta configurada)
- Swagger UI disponível em: `http://localhost:5224/swagger`

### Frontend (React / Vite)

```bash
cd frontend
npm run dev
```

- Interface disponível em: `http://localhost:5173`

---

## 📐 Convenções de Código e Versionamento

- **Estratégia de Branches:** Utilização estrita do **Git Flow** (`main` para lançamentos de produção, `develop` para consolidação, `feature/*` para novos desenvolvimentos e `hotfix/*` para correções críticas imediatas).
- **Tags HTML:** Todas as tags JSX/HTML no frontend **devem ter fechamento explícito** (ex.: `<input></input>`, `<button></button>`, `<select></select>`).
- **Modificações Pontuais:** Arquivos não devem ser reescritos integralmente desnecessariamente; prioriza-se clareza de contexto e explicações de impacto de arquitetura.
