using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace SMARsvd.Desktop;

// Inicia o SMARsvd.API.exe em segundo plano, sem janela de console, ouvindo apenas em 127.0.0.1 numa porta
// livre. Assim o servidor não fica exposto na rede e não entra em conflito com outra instância ou programa.
internal sealed class ServidorLocal : IDisposable
{
    private static readonly TimeSpan TempoMaximoInicializacao = TimeSpan.FromSeconds(90);

    // Linha escrita pelo servidor ao começar a ouvir (veja Program.cs da API)
    private static readonly Regex LinhaEndereco = new(@"^SMARSVD_ENDERECO_SERVIDOR=(http://127\.0\.0\.1:\d{1,5})/?$", RegexOptions.CultureInvariant);

    private readonly CaminhosAplicacao _caminhos;
    private readonly ObjetoTrabalhoWindows _objetoTrabalho = new();
    private readonly object _travaLog = new();
    private readonly TaskCompletionSource<Uri> _enderecoAnunciado = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Process? _processo;
    private StreamWriter? _log;
    private bool _encerrando;

    public Uri? Endereco { get; private set; }

    public string ArquivoLog => Path.Combine(_caminhos.PastaLogs, "servidor.log");

    // Disparado quando o servidor termina sem que o encerramento tenha sido solicitado
    public event EventHandler? EncerradoInesperadamente;

    public ServidorLocal(CaminhosAplicacao caminhos)
    {
        _caminhos = caminhos;
    }

    public async Task IniciarAsync(CancellationToken cancelamento)
    {
        if (!File.Exists(_caminhos.ExecutavelServidor))
            throw new FileNotFoundException(
                $"Os arquivos do servidor não foram encontrados em:\n{_caminhos.PastaServidor}\n\n" +
                "Verifique se a pasta SMARsvd foi copiada por completo.", _caminhos.ExecutavelServidor);

        Directory.CreateDirectory(_caminhos.PastaBanco);
        Directory.CreateDirectory(_caminhos.PastaTemporaria);
        AbrirLog();

        var inicio = new ProcessStartInfo(_caminhos.ExecutavelServidor)
        {
            WorkingDirectory = _caminhos.PastaServidor,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        // Porta 0: o próprio sistema operacional escolhe uma porta livre no momento em que o servidor a ocupa
        inicio.ArgumentList.Add("--urls");
        inicio.ArgumentList.Add("http://127.0.0.1:0");

        // Caminhos absolutos calculados a partir da pasta atual do pacote sobrescrevem os do appsettings.json
        inicio.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
        inicio.Environment["SMARSVD_ANUNCIAR_ENDERECO"] = "true";
        // Recusa requisições com outro nome de host (ataques de DNS rebinding a partir de páginas da internet)
        inicio.Environment["AllowedHosts"] = "127.0.0.1;localhost";
        inicio.Environment["ConnectionStrings__DefaultConnection"] = $"Data Source=\"{_caminhos.ArquivoBanco}\"";
        inicio.Environment["OCR__ModelPath"] = _caminhos.PastaTessdata;
        inicio.Environment["DadosTemporarios__Pasta"] = _caminhos.PastaTemporaria;
        inicio.Environment["Logging__LogLevel__Microsoft.EntityFrameworkCore"] = "Warning";
        inicio.Environment["Logging__Console__FormatterName"] = "simple";
        inicio.Environment["Logging__Console__FormatterOptions__TimestampFormat"] = "yyyy-MM-dd HH:mm:ss ";
        inicio.Environment["Logging__Console__FormatterOptions__ColorBehavior"] = "Disabled";

        var processo = new Process { StartInfo = inicio, EnableRaisingEvents = true };
        processo.OutputDataReceived += (_, e) => AoReceberSaida(e.Data);
        processo.ErrorDataReceived += (_, e) => RegistrarLog(e.Data);
        processo.Exited += AoEncerrarProcesso;

        processo.Start();
        _processo = processo;
        _objetoTrabalho.Associar(processo);
        processo.BeginOutputReadLine();
        processo.BeginErrorReadLine();

        Endereco = await AguardarEnderecoAsync(processo, cancelamento);
        await AguardarDisponibilidadeAsync(processo, Endereco, cancelamento);
    }

    private void AoReceberSaida(string? linha)
    {
        if (linha != null && !_enderecoAnunciado.Task.IsCompleted && LinhaEndereco.Match(linha.Trim()) is { Success: true } endereco)
            _enderecoAnunciado.TrySetResult(new Uri(endereco.Groups[1].Value + "/"));

        RegistrarLog(linha);
    }

    private async Task<Uri> AguardarEnderecoAsync(Process processo, CancellationToken cancelamento)
    {
        var limite = DateTime.UtcNow + TempoMaximoInicializacao;

        while (DateTime.UtcNow < limite)
        {
            cancelamento.ThrowIfCancellationRequested();

            if (_enderecoAnunciado.Task.IsCompleted)
                return await _enderecoAnunciado.Task;

            if (processo.HasExited)
                throw new InvalidOperationException(
                    $"O servidor do SMARsvd foi encerrado durante a inicialização (código {processo.ExitCode}).");

            await Task.Delay(100, cancelamento);
        }

        throw new TimeoutException("O servidor do SMARsvd não respondeu dentro do tempo esperado.");
    }

    private static async Task AguardarDisponibilidadeAsync(Process processo, Uri endereco, CancellationToken cancelamento)
    {
        using var cliente = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var limite = DateTime.UtcNow + TempoMaximoInicializacao;

        while (DateTime.UtcNow < limite)
        {
            cancelamento.ThrowIfCancellationRequested();

            if (processo.HasExited)
                throw new InvalidOperationException(
                    $"O servidor do SMARsvd foi encerrado durante a inicialização (código {processo.ExitCode}).");

            try
            {
                using var resposta = await cliente.GetAsync(endereco, cancelamento);
                return;
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException) when (!cancelamento.IsCancellationRequested)
            {
            }

            await Task.Delay(250, cancelamento);
        }

        throw new TimeoutException("O servidor do SMARsvd não respondeu dentro do tempo esperado.");
    }

    private void AoEncerrarProcesso(object? sender, EventArgs e)
    {
        if (_encerrando || sender is not Process processo)
            return;

        RegistrarLog($"[SMARsvd.exe] Servidor encerrado inesperadamente (código {processo.ExitCode}).");
        EncerradoInesperadamente?.Invoke(this, EventArgs.Empty);
    }

    public void Encerrar()
    {
        _encerrando = true;
        var processo = _processo;
        _processo = null;

        if (processo != null)
        {
            try
            {
                if (!processo.HasExited)
                {
                    processo.Kill(entireProcessTree: true);
                    processo.WaitForExit(5000);
                }
            }
            catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
            {
                RegistrarLog($"[SMARsvd.exe] Falha ao encerrar o servidor: {ex.Message}");
            }
            finally
            {
                processo.Dispose();
            }
        }

        LimparDadosTemporarios();
        FecharLog();
    }

    // Os arquivos de trabalho contêm dados dos contribuintes e não devem permanecer após o fechamento
    private void LimparDadosTemporarios()
    {
        if (!Directory.Exists(_caminhos.PastaTemporaria))
            return;

        foreach (var item in Directory.EnumerateFileSystemEntries(_caminhos.PastaTemporaria))
        {
            try
            {
                if (Directory.Exists(item))
                    Directory.Delete(item, recursive: true);
                else
                    File.Delete(item);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                RegistrarLog($"[SMARsvd.exe] Não foi possível excluir {item}: {ex.Message}");
            }
        }
    }

    private void AbrirLog()
    {
        try
        {
            Directory.CreateDirectory(_caminhos.PastaLogs);
            string logAnterior = Path.Combine(_caminhos.PastaLogs, "servidor.anterior.log");
            if (File.Exists(ArquivoLog))
                File.Copy(ArquivoLog, logAnterior, overwrite: true);

            _log = new StreamWriter(new FileStream(ArquivoLog, FileMode.Create, FileAccess.Write, FileShare.Read), Encoding.UTF8)
            {
                AutoFlush = true
            };
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Sem permissão de escrita nos logs o sistema continua funcionando, apenas sem o registro
            _log = null;
        }
    }

    private void RegistrarLog(string? linha)
    {
        if (linha == null)
            return;

        lock (_travaLog)
        {
            _log?.WriteLine(linha);
        }
    }

    private void FecharLog()
    {
        lock (_travaLog)
        {
            _log?.Dispose();
            _log = null;
        }
    }

    public void Dispose()
    {
        Encerrar();
        _objetoTrabalho.Dispose();
    }
}
