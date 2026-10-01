<#
.SYNOPSIS
    Inicia o SMARsvd pelo código-fonte (servidor + interface) e abre o sistema numa janela própria.

.DESCRIPTION
    Substitui o "dotnet run" e o "npm run dev" em terminais separados: os dois são iniciados neste mesmo
    terminal, com as mensagens identificadas por [servidor] e [interface]. Quando ambos estão no ar, o sistema
    é aberto numa janela do navegador em modo aplicativo (sem abas, com um perfil exclusivo) e o terminal é
    minimizado.

    Ao fechar a janela do sistema, o servidor e a interface são encerrados, os arquivos de trabalho temporários
    são apagados e o terminal é fechado. Fechar o terminal (ou pressionar Ctrl+C nele) também encerra tudo,
    inclusive a janela do sistema.

    Se o atalho for aberto com o sistema já em execução, apenas uma nova janela do sistema é aberta.

.PARAMETER CriarAtalho
    Cria o atalho "SMARsvd (desenvolvimento)" na Área de Trabalho e termina, sem iniciar o sistema.

.EXAMPLE
    .\scripts\iniciar.ps1 -CriarAtalho
#>
[CmdletBinding()]
param(
    [switch]$CriarAtalho
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$pastaServidor = Join-Path $raiz 'backend\SMARsvd.API'
$pastaFrontend = Join-Path $raiz 'frontend'
$pastaTemporaria = Join-Path $raiz 'database\temp'
# Devem acompanhar o launchSettings.json do servidor e o vite.config.ts da interface
$portaServidor = 5224
$portaInterface = 5173
$enderecoSistema = "http://localhost:$portaInterface/"
$pastaPerfisNavegador = Join-Path $env:LOCALAPPDATA 'SMARsvd\NavegadorDesenvolvimento'
$tempoMaximoInicializacao = [TimeSpan]::FromMinutes(5)

if ($CriarAtalho) {
    $arquivoAtalho = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SMARsvd (desenvolvimento).lnk'
    $atalho = (New-Object -ComObject WScript.Shell).CreateShortcut($arquivoAtalho)
    $atalho.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $atalho.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $atalho.WorkingDirectory = $raiz
    $atalho.IconLocation = (Join-Path $raiz 'frontend\src\assets\icone-sistema.ico') + ',0'
    $atalho.Description = 'Inicia o SMARsvd pelo código-fonte (servidor e interface)'
    $atalho.Save()
    Write-Host "Atalho criado: $arquivoAtalho" -ForegroundColor Green
    return
}

if (-not ('SMARsvd.Inicializacao.Terminal' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace SMARsvd.Inicializacao
{
    // Job Object do Windows configurado para encerrar os processos associados quando o handle é fechado. O terminal
    // é associado a ele e os processos filhos (dotnet, node e o navegador) herdam a associação; assim o Windows
    // encerra todos quando o terminal é fechado, mesmo de forma abrupta.
    public static class ObjetoTrabalho
    {
        private const int JobObjectExtendedLimitInformation = 9;
        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

        private static IntPtr _handle;

        public static void AssociarProcessoAtual()
        {
            IntPtr handle = CreateJobObject(IntPtr.Zero, null);
            if (handle == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error());

            var informacao = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            informacao.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            int tamanho = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            IntPtr ponteiro = Marshal.AllocHGlobal(tamanho);
            try
            {
                Marshal.StructureToPtr(informacao, ponteiro, false);
                if (!SetInformationJobObject(handle, JobObjectExtendedLimitInformation, ponteiro, (uint)tamanho))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            finally
            {
                Marshal.FreeHGlobal(ponteiro);
            }

            if (!AssignProcessToJobObject(handle, GetCurrentProcess()))
                throw new Win32Exception(Marshal.GetLastWin32Error());

            _handle = handle;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetInformationJobObject(IntPtr hJob, int infoType, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetCurrentProcess();
    }

    public static class Terminal
    {
        private const int SW_MINIMIZE = 6;
        private const int SW_RESTORE = 9;

        private static readonly object Trava = new object();

        // As mensagens dos processos chegam em outras threads; a trava evita que as linhas se misturem
        public static void Escrever(string origem, ConsoleColor cor, string linha)
        {
            lock (Trava)
            {
                ConsoleColor corAnterior = Console.ForegroundColor;
                Console.ForegroundColor = cor;
                Console.Write("[" + origem + "] ");
                Console.ForegroundColor = corAnterior;
                Console.WriteLine(linha);
            }
        }

        // Sem janela própria, com as mensagens repassadas para este terminal
        public static Process IniciarProcesso(string arquivo, string argumentos, string pasta, Encoding codificacao, string origem, ConsoleColor cor)
        {
            var inicio = new ProcessStartInfo(arquivo, argumentos);
            inicio.WorkingDirectory = pasta;
            inicio.UseShellExecute = false;
            inicio.CreateNoWindow = true;
            inicio.RedirectStandardOutput = true;
            inicio.RedirectStandardError = true;
            inicio.StandardOutputEncoding = codificacao;
            inicio.StandardErrorEncoding = codificacao;

            var processo = new Process();
            processo.StartInfo = inicio;
            DataReceivedEventHandler aoReceber = (remetente, e) =>
            {
                if (e.Data != null)
                    Escrever(origem, cor, e.Data);
            };
            processo.OutputDataReceived += aoReceber;
            processo.ErrorDataReceived += aoReceber;
            processo.Start();
            processo.BeginOutputReadLine();
            processo.BeginErrorReadLine();
            return processo;
        }

        // Quando o script é executado de dentro de outro terminal (ex.: o do editor), a janela não pertence a ele
        public static bool PossuiJanelaExclusiva()
        {
            uint[] processos = new uint[8];
            return GetConsoleProcessList(processos, (uint)processos.Length) == 1;
        }

        public static void Minimizar()
        {
            if (PossuiJanelaExclusiva())
                ShowWindow(GetConsoleWindow(), SW_MINIMIZE);
        }

        public static void Restaurar()
        {
            if (PossuiJanelaExclusiva())
                ShowWindow(GetConsoleWindow(), SW_RESTORE);
        }

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetConsoleWindow();

        [DllImport("kernel32.dll")]
        private static extern uint GetConsoleProcessList(uint[] lpdwProcessList, uint dwProcessCount);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
}
'@
}

function Escrever-Mensagem([string]$mensagem, [ConsoleColor]$cor = [ConsoleColor]::Cyan) {
    [SMARsvd.Inicializacao.Terminal]::Escrever('SMARsvd', $cor, $mensagem)
}

function Porta-EmUso([int]$porta) {
    $escutando = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return [bool]($escutando | Where-Object { $_.Port -eq $porta })
}

function Descrever-ProcessoNaPorta([int]$porta) {
    $conexao = Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conexao) { return 'outro programa' }
    $processo = Get-CimInstance Win32_Process -Filter "ProcessId=$($conexao.OwningProcess)" -ErrorAction SilentlyContinue
    if (-not $processo) { return "o processo $($conexao.OwningProcess)" }
    return "$($processo.Name) (PID $($processo.ProcessId)): $($processo.CommandLine)"
}

function Aguardar-Porta([int]$porta, [System.Diagnostics.Process]$processo, [string]$descricao) {
    $limite = [DateTime]::Now + $tempoMaximoInicializacao
    while (-not (Porta-EmUso $porta)) {
        if ($processo -and $processo.HasExited) {
            throw "O $descricao foi encerrado durante a inicialização (código $($processo.ExitCode)). Veja as mensagens acima."
        }
        if ([DateTime]::Now -gt $limite) {
            throw "O $descricao não ficou disponível na porta $porta dentro do tempo esperado."
        }
        Start-Sleep -Milliseconds 500
    }
}

function Obter-Navegador {
    $padrao = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice' -ErrorAction SilentlyContinue).ProgId
    $candidatos = if ($padrao -like 'ChromeHTML*') { 'chrome.exe', 'msedge.exe' } else { 'msedge.exe', 'chrome.exe' }
    foreach ($executavel in $candidatos) {
        foreach ($registro in 'HKCU:', 'HKLM:') {
            $caminho = (Get-ItemProperty "$registro\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$executavel" -ErrorAction SilentlyContinue).'(default)'
            if ($caminho -and (Test-Path $caminho.Trim('"'))) { return $caminho.Trim('"') }
        }
    }
    throw 'Nenhum navegador compatível foi encontrado (Microsoft Edge ou Google Chrome).'
}

function Abrir-JanelaSistema([string]$navegador, [string]$perfil) {
    $argumentos = @(
        "--app=$enderecoSistema",
        "--user-data-dir=`"$perfil`"",
        '--no-first-run',
        '--no-default-browser-check',
        '--start-maximized'
    )
    return Start-Process $navegador -ArgumentList $argumentos -PassThru
}

# Se já houver uma janela com o mesmo perfil aberta, o navegador recém-iniciado repassa o pedido para ela e
# termina; por isso o processo que importa é o principal (sem --type=) que usa o perfil do sistema
function Obter-ProcessoPrincipalNavegador([string]$perfil) {
    $principal = Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($perfil) -and $_.CommandLine -notmatch '--type=' } |
        Select-Object -First 1
    if ($principal) {
        return Get-Process -Id $principal.ProcessId -ErrorAction SilentlyContinue
    }
}

function Encerrar-ArvoreProcessos([System.Diagnostics.Process]$processo) {
    if ($processo -and -not $processo.HasExited) {
        & taskkill.exe /PID $processo.Id /T /F 2>&1 | Out-Null
    }
}

$Host.UI.RawUI.WindowTitle = 'SMARsvd (desenvolvimento)'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$navegador = Obter-Navegador
$perfilNavegador = Join-Path $pastaPerfisNavegador ([System.IO.Path]::GetFileNameWithoutExtension($navegador))

$instanciaUnica = New-Object System.Threading.Mutex($false, 'Local\SMARsvd.Desenvolvimento')
try {
    $possuiInstancia = $instanciaUnica.WaitOne(0)
}
catch [System.Threading.AbandonedMutexException] {
    $possuiInstancia = $true
}

if (-not $possuiInstancia) {
    Escrever-Mensagem 'O sistema já está em execução; abrindo uma nova janela.'
    Aguardar-Porta $portaInterface $null 'sistema'
    Abrir-JanelaSistema $navegador $perfilNavegador | Out-Null
    return
}

$servidor = $null
$interface = $null
try {
    foreach ($ferramenta in 'dotnet', 'npm') {
        if (-not (Get-Command $ferramenta -ErrorAction SilentlyContinue)) {
            throw "A ferramenta '$ferramenta' não foi encontrada. Veja a seção 'Instalação e execução' do README."
        }
    }

    foreach ($porta in $portaServidor, $portaInterface) {
        if (Porta-EmUso $porta) {
            throw "A porta $porta já está em uso por $(Descrever-ProcessoNaPorta $porta). Encerre esse programa e tente novamente."
        }
    }

    if (-not (Test-Path (Join-Path $pastaFrontend 'node_modules'))) {
        Escrever-Mensagem 'Instalando as dependências da interface (somente na primeira vez)...'
        Push-Location $pastaFrontend
        try {
            & npm install
            if ($LASTEXITCODE -ne 0) { throw "A instalação das dependências da interface falhou (código $LASTEXITCODE)." }
        }
        finally {
            Pop-Location
        }
    }

    try {
        [SMARsvd.Inicializacao.ObjetoTrabalho]::AssociarProcessoAtual()
    }
    catch {
        Escrever-Mensagem "Aviso: se este terminal for fechado à força, o servidor e a interface podem continuar em execução ($($_.Exception.Message))." Yellow
    }

    # O dotnet escreve na página de código do console (sem janela, o processo filho recebe um console próprio); o Node sempre usa UTF-8
    $codificacaoConsole = [System.Text.Encoding]::GetEncoding([Globalization.CultureInfo]::CurrentCulture.TextInfo.OEMCodePage)

    Escrever-Mensagem 'Iniciando o servidor (dotnet run) e a interface (npm run dev)...'
    $servidor = [SMARsvd.Inicializacao.Terminal]::IniciarProcesso(
        'dotnet', 'run', $pastaServidor, $codificacaoConsole, 'servidor', [ConsoleColor]::Magenta)
    $interface = [SMARsvd.Inicializacao.Terminal]::IniciarProcesso(
        'cmd.exe', '/d /c npm run dev', $pastaFrontend, [System.Text.Encoding]::UTF8, 'interface', [ConsoleColor]::Green)

    Aguardar-Porta $portaInterface $interface 'processo da interface'
    Aguardar-Porta $portaServidor $servidor 'servidor'

    Escrever-Mensagem "Sistema no ar em $enderecoSistema. Feche a janela do sistema para encerrar tudo." Green
    $janela = Abrir-JanelaSistema $navegador $perfilNavegador
    [SMARsvd.Inicializacao.Terminal]::Minimizar()

    $falhaInformada = $false
    while ($true) {
        if ($janela.HasExited) {
            $janela = Obter-ProcessoPrincipalNavegador $perfilNavegador
            if (-not $janela) { break }
        }

        if (-not $falhaInformada -and ($servidor.HasExited -or $interface.HasExited)) {
            $falhaInformada = $true
            $parte = if ($servidor.HasExited) { 'O servidor' } else { 'O processo da interface' }
            Escrever-Mensagem "$parte foi encerrado inesperadamente. Veja as mensagens acima; feche a janela do sistema e abra o atalho novamente." Red
            [SMARsvd.Inicializacao.Terminal]::Restaurar()
        }

        Start-Sleep -Milliseconds 500
    }

    Escrever-Mensagem 'Janela do sistema fechada; encerrando o servidor e a interface...'
}
catch {
    Escrever-Mensagem $_.Exception.Message Red
    Encerrar-ArvoreProcessos $servidor
    Encerrar-ArvoreProcessos $interface
    if ([SMARsvd.Inicializacao.Terminal]::PossuiJanelaExclusiva()) {
        [SMARsvd.Inicializacao.Terminal]::Restaurar()
        Read-Host 'Pressione Enter para fechar'
    }
}
finally {
    Encerrar-ArvoreProcessos $servidor
    Encerrar-ArvoreProcessos $interface

    # Os arquivos de trabalho contêm dados dos contribuintes e não devem permanecer após o encerramento
    if ($servidor -and (Test-Path $pastaTemporaria)) {
        Get-ChildItem $pastaTemporaria -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }

    $instanciaUnica.ReleaseMutex()
    $instanciaUnica.Dispose()
}
