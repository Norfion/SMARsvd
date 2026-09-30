<#
.SYNOPSIS
    Gera o pacote portátil do SMARsvd (arquivo dist\SMARsvd.zip).

.DESCRIPTION
    O pacote é autocontido: inclui o runtime do .NET, o servidor, a interface já compilada e o modelo do OCR.
    Na máquina de destino basta descompactar o arquivo em uma pasta (ex.: SMARsvd) e executar o SMARsvd.exe;
    não é necessário instalar .NET, Node.js ou qualquer outra ferramenta.

    Os arquivos ficam na raiz do .zip, para que a opção "Extrair tudo" do Windows (que sugere a pasta
    SMARsvd) não gere uma pasta SMARsvd\SMARsvd.

.PARAMETER Destino
    Pasta onde o pacote será gerado. Padrão: dist\ na raiz do repositório.

.PARAMETER SemBancoAtual
    Não copia o banco interno atual (database\SMARtb_SVD_dados.db). O pacote criará um banco vazio,
    sem layouts cadastrados, na primeira execução.

.PARAMETER SemZip
    Gera apenas a pasta dist\SMARsvd, sem o arquivo .zip (útil para testar o pacote localmente).

.PARAMETER WebView2Fixo
    Pasta de um "WebView2 Runtime Fixed Version" já extraído, para máquinas que não possuem o runtime
    instalado (ele já acompanha o Windows 11 e o Windows 10 atualizado).

.EXAMPLE
    .\scripts\empacotar.ps1
#>
[CmdletBinding()]
param(
    [string]$Destino,
    [switch]$SemBancoAtual,
    [switch]$SemZip,
    [string]$WebView2Fixo
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
if (-not $Destino) { $Destino = Join-Path $raiz 'dist' }
$Destino = [System.IO.Path]::GetFullPath($Destino)
$pastaDescompactada = Join-Path $Destino 'SMARsvd'
$arquivoZip = Join-Path $Destino 'SMARsvd.zip'
# Quando o .zip é gerado, a pasta de montagem é provisória e apagada ao final
$pacote = if ($SemZip) { $pastaDescompactada } else { Join-Path $Destino 'SMARsvd-montagem' }
$pastaServidor = Join-Path $pacote 'app\servidor'
$identificadorRuntime = 'win-x64'

function Escrever-Etapa([string]$mensagem) {
    Write-Host ''
    Write-Host "==> $mensagem" -ForegroundColor Cyan
}

function Invocar-Comando([string]$pasta, [string]$comando, [string[]]$argumentos) {
    Push-Location $pasta
    try {
        & $comando @argumentos
        if ($LASTEXITCODE -ne 0) {
            throw "O comando '$comando $($argumentos -join ' ')' falhou (código $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }
}

function Remover-Pasta([string]$pasta) {
    if (-not (Test-Path $pasta)) { return }
    $emExecucao = Get-Process -Name 'SMARsvd', 'SMARsvd.API' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($pasta, [System.StringComparison]::OrdinalIgnoreCase) }
    if ($emExecucao) {
        throw "Feche o SMARsvd que está sendo executado a partir de '$pasta' antes de gerar um novo pacote."
    }
    Remove-Item $pasta -Recurse -Force
}

foreach ($ferramenta in 'dotnet', 'npm') {
    if (-not (Get-Command $ferramenta -ErrorAction SilentlyContinue)) {
        throw "A ferramenta '$ferramenta' não foi encontrada. Ela é necessária apenas para gerar o pacote, não na máquina de destino."
    }
}

Escrever-Etapa "Preparando a pasta $pacote"
Remover-Pasta $pacote
if (-not $SemZip) {
    Remover-Pasta $pastaDescompactada
}
New-Item -ItemType Directory -Force -Path $pacote | Out-Null

try {
    Escrever-Etapa 'Compilando a interface (frontend)'
    $pastaFrontend = Join-Path $raiz 'frontend'
    if (-not (Test-Path (Join-Path $pastaFrontend 'node_modules'))) {
        Invocar-Comando $pastaFrontend 'npm' @('ci')
    }
    Invocar-Comando $pastaFrontend 'npm' @('run', 'build')

    Escrever-Etapa 'Publicando o servidor (backend)'
    Invocar-Comando $raiz 'dotnet' @(
        'publish', (Join-Path $raiz 'backend\SMARsvd.API\SMARsvd.API.csproj'),
        '-c', 'Release',
        '-r', $identificadorRuntime,
        '--self-contained', 'true',
        '-o', $pastaServidor,
        '-p:DebugType=none',
        '-p:SatelliteResourceLanguages=pt-BR'
    )
    Remove-Item (Join-Path $pastaServidor 'appsettings.Development.json') -ErrorAction SilentlyContinue
    # O pacote é 64 bits; as bibliotecas nativas de 32 bits do Tesseract nunca são carregadas
    Remove-Item (Join-Path $pastaServidor 'x86') -Recurse -ErrorAction SilentlyContinue

    Escrever-Etapa 'Copiando a interface e o modelo do OCR para o servidor'
    Copy-Item (Join-Path $pastaFrontend 'dist') (Join-Path $pastaServidor 'wwwroot') -Recurse
    $pastaTessdata = Join-Path $pastaServidor 'tessdata'
    New-Item -ItemType Directory -Force -Path $pastaTessdata | Out-Null
    Copy-Item (Join-Path $raiz 'backend\SMARsvd.IA\Models\OCR\tessdata\*.traineddata') $pastaTessdata

    # As bibliotecas nativas do Tesseract (OCR) dependem do Visual C++ Redistributable. Levar as DLLs junto
    # com o servidor (implantação local, permitida pela Microsoft) evita exigir essa instalação no destino.
    $bibliotecasVisualCpp = 'vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll'
    foreach ($biblioteca in $bibliotecasVisualCpp) {
        $origem = Join-Path $env:SystemRoot "System32\$biblioteca"
        if (Test-Path $origem) {
            Copy-Item $origem $pastaServidor
        }
        else {
            Write-Warning "$biblioteca não foi encontrada nesta máquina; o OCR exigirá o Visual C++ Redistributable no destino."
        }
    }

    Escrever-Etapa 'Publicando o executável SMARsvd.exe'
    Invocar-Comando $raiz 'dotnet' @(
        'publish', (Join-Path $raiz 'desktop\SMARsvd.Desktop\SMARsvd.Desktop.csproj'),
        '-c', 'Release',
        '-r', $identificadorRuntime,
        '--self-contained', 'true',
        '-o', $pacote,
        '-p:PublishSingleFile=true',
        '-p:IncludeNativeLibrariesForSelfExtract=true',
        '-p:EnableCompressionInSingleFile=true',
        '-p:DebugType=none',
        '-p:SatelliteResourceLanguages=pt-BR'
    )

    Escrever-Etapa 'Preparando o banco de dados interno'
    $pastaBancoPacote = Join-Path $pacote 'database'
    New-Item -ItemType Directory -Force -Path $pastaBancoPacote | Out-Null
    $bancoAtual = Join-Path $raiz 'database\SMARtb_SVD_dados.db'
    if (-not $SemBancoAtual -and (Test-Path $bancoAtual)) {
        # O arquivo -wal guarda gravações ainda não consolidadas no banco (modo WAL) e precisa acompanhá-lo
        foreach ($sufixo in '', '-wal') {
            $arquivo = "$bancoAtual$sufixo"
            if (Test-Path $arquivo) { Copy-Item $arquivo $pastaBancoPacote }
        }
        Write-Host 'Banco atual copiado (layouts e registros existentes serão mantidos).'
    }
    else {
        Write-Host 'O banco será criado vazio na primeira execução.'
    }

    if ($WebView2Fixo) {
        Escrever-Etapa 'Copiando o WebView2 Runtime (Fixed Version)'
        if (-not (Test-Path (Join-Path $WebView2Fixo 'msedgewebview2.exe'))) {
            throw "A pasta '$WebView2Fixo' não contém um WebView2 Runtime Fixed Version (msedgewebview2.exe)."
        }
        Copy-Item $WebView2Fixo (Join-Path $pacote 'app\webview2') -Recurse
    }

    $tamanhoMb = [math]::Round(((Get-ChildItem $pacote -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)

    if (-not $SemZip) {
        Escrever-Etapa 'Compactando o pacote'
        Remove-Item $arquivoZip -ErrorAction SilentlyContinue
        Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
        # As entradas são criadas uma a uma porque o CreateFromDirectory do Windows PowerShell grava os
        # caminhos com "\", fora do padrão do formato zip e mal interpretado por outros descompactadores
        $zip = [System.IO.Compression.ZipFile]::Open($arquivoZip, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($item in Get-ChildItem $pacote -Recurse -Force) {
                $nomeEntrada = $item.FullName.Substring($pacote.Length + 1).Replace('\', '/')
                if ($item.PSIsContainer) {
                    if (-not (Get-ChildItem $item.FullName -Force | Select-Object -First 1)) {
                        $zip.CreateEntry("$nomeEntrada/") | Out-Null
                    }
                }
                else {
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                        $zip, $item.FullName, $nomeEntrada, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
                }
            }
        }
        finally {
            $zip.Dispose()
        }
    }
}
finally {
    if (-not $SemZip -and (Test-Path $pacote)) {
        Remove-Item $pacote -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ''
if ($SemZip) {
    Write-Host "Pacote gerado com sucesso ($tamanhoMb MB):" -ForegroundColor Green
    Write-Host "  Pasta: $pacote"
    Write-Host '  Na máquina de destino: copie a pasta SMARsvd e execute (ou crie um atalho para) SMARsvd.exe.'
}
else {
    $tamanhoZipMb = [math]::Round((Get-Item $arquivoZip).Length / 1MB, 1)
    Write-Host "Pacote gerado com sucesso ($tamanhoMb MB descompactado, $tamanhoZipMb MB compactado):" -ForegroundColor Green
    Write-Host "  Arquivo: $arquivoZip"
    Write-Host '  Na máquina de destino: descompacte o arquivo em uma pasta (ex.: SMARsvd) e execute (ou crie um atalho para) SMARsvd.exe.'
}
