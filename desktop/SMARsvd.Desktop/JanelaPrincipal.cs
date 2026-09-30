using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SMARsvd.Desktop;

internal sealed class JanelaPrincipal : Form
{
    private const string TituloPadrao = "SMARtb SVD";

    private readonly CaminhosAplicacao _caminhos;
    private readonly ServidorLocal _servidor;
    private readonly CancellationTokenSource _cancelamento = new();
    private readonly WebView2 _navegador;
    private readonly Panel _painelCarregamento;
    private readonly Panel _blocoCarregamento;

    public JanelaPrincipal(CaminhosAplicacao caminhos)
    {
        _caminhos = caminhos;
        _servidor = new ServidorLocal(caminhos);
        _servidor.EncerradoInesperadamente += (_, _) => ExecutarNaJanela(AoPerderServidor);

        Text = TituloPadrao;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1366, 800);
        MinimumSize = new Size(1024, 640);
        WindowState = FormWindowState.Maximized;
        BackColor = Color.White;

        _navegador = new WebView2
        {
            Dock = DockStyle.Fill,
            Visible = false,
            DefaultBackgroundColor = Color.White
        };

        var mensagem = new Label
        {
            Text = "Iniciando o SMARtb SVD...",
            Dock = DockStyle.Top,
            Height = 40,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 12F),
            ForeColor = Color.FromArgb(0x33, 0x33, 0x33)
        };

        var barraProgresso = new ProgressBar
        {
            Style = ProgressBarStyle.Marquee,
            MarqueeAnimationSpeed = 30,
            Dock = DockStyle.Top,
            Height = 8
        };

        // No encaixe (Dock) o último controle adicionado é posicionado primeiro: a mensagem fica acima da barra
        _blocoCarregamento = new Panel { Size = new Size(420, 48) };
        _blocoCarregamento.Controls.Add(barraProgresso);
        _blocoCarregamento.Controls.Add(mensagem);

        _painelCarregamento = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
        _painelCarregamento.Controls.Add(_blocoCarregamento);
        _painelCarregamento.Resize += (_, _) => CentralizarCarregamento();

        Controls.Add(_navegador);
        Controls.Add(_painelCarregamento);

        Shown += async (_, _) => await IniciarAsync();
    }

    private void CentralizarCarregamento() =>
        _blocoCarregamento.Location = new Point(
            Math.Max(0, (_painelCarregamento.ClientSize.Width - _blocoCarregamento.Width) / 2),
            Math.Max(0, (_painelCarregamento.ClientSize.Height - _blocoCarregamento.Height) / 2));

    private bool Encerrando => _cancelamento.IsCancellationRequested || IsDisposed;

    private async Task IniciarAsync()
    {
        CentralizarCarregamento();

        try
        {
            // O navegador embutido e o servidor são preparados ao mesmo tempo para reduzir a espera
            var inicializacaoNavegador = InicializarNavegadorAsync();
            await _servidor.IniciarAsync(_cancelamento.Token);
            await inicializacaoNavegador;

            if (!Encerrando)
                _navegador.CoreWebView2.Navigate(_servidor.Endereco!.ToString());
        }
        catch (Exception) when (Encerrando)
        {
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MostrarErroEFechar(
                "O componente Microsoft Edge WebView2 Runtime, necessário para exibir a interface, não foi encontrado neste computador.\n\n" +
                "Ele já acompanha o Windows 11 e as versões atualizadas do Windows 10. Para resolver, instale o runtime " +
                "disponível em https://developer.microsoft.com/microsoft-edge/webview2/ ou copie a versão \"Fixed Version\" " +
                $"para a pasta:\n{_caminhos.PastaWebView2Fixo}");
        }
        catch (Exception ex)
        {
            MostrarErroEFechar(
                $"Não foi possível iniciar o SMARtb SVD.\n\n{ex.Message}\n\n" +
                $"Detalhes técnicos podem ser encontrados em:\n{_servidor.ArquivoLog}");
        }
    }

    private async Task InicializarNavegadorAsync()
    {
        string? pastaRuntimeFixo = Directory.Exists(_caminhos.PastaWebView2Fixo) ? _caminhos.PastaWebView2Fixo : null;
        var opcoes = new CoreWebView2EnvironmentOptions { Language = "pt-BR" };
        var ambiente = await CoreWebView2Environment.CreateAsync(pastaRuntimeFixo, _caminhos.PastaDadosNavegador, opcoes);
        await _navegador.EnsureCoreWebView2Async(ambiente);

        var nucleo = _navegador.CoreWebView2;
        nucleo.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("SMARSVD_DEVTOOLS") == "1";
        nucleo.Settings.IsStatusBarEnabled = false;
        nucleo.Settings.IsPasswordAutosaveEnabled = false;
        nucleo.Settings.IsGeneralAutofillEnabled = false;
        // A interface não conversa com o executável: nenhuma ponte entre a página e o processo nativo fica disponível
        nucleo.Settings.AreHostObjectsAllowed = false;
        nucleo.Settings.IsWebMessageEnabled = false;

        nucleo.DocumentTitleChanged += (_, _) =>
            Text = string.IsNullOrWhiteSpace(nucleo.DocumentTitle) ? TituloPadrao : nucleo.DocumentTitle;
        nucleo.NavigationStarting += AoIniciarNavegacao;
        nucleo.NewWindowRequested += AoSolicitarNovaJanela;
        nucleo.NavigationCompleted += AoConcluirNavegacao;
        nucleo.ProcessFailed += AoFalharProcessoNavegador;
    }

    private bool EhEnderecoDoSistema(string endereco) =>
        _servidor.Endereco != null
        && Uri.TryCreate(endereco, UriKind.Absolute, out var uri)
        && (uri.Scheme is "blob" or "data" or "about"
            || Uri.Compare(uri, _servidor.Endereco, UriComponents.SchemeAndServer, UriFormat.Unescaped, StringComparison.OrdinalIgnoreCase) == 0);

    // Links externos abrem no navegador padrão, para que a janela do sistema nunca saia da aplicação
    private void AoIniciarNavegacao(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (EhEnderecoDoSistema(e.Uri))
            return;

        e.Cancel = true;
        AbrirNoNavegadorPadrao(e.Uri);
    }

    private void AoSolicitarNovaJanela(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        if (EhEnderecoDoSistema(e.Uri))
            return;

        e.Handled = true;
        AbrirNoNavegadorPadrao(e.Uri);
    }

    private static void AbrirNoNavegadorPadrao(string endereco)
    {
        if (!Uri.TryCreate(endereco, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeMailto))
            return;

        try
        {
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
        }
    }

    private void AoConcluirNavegacao(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (_navegador.Visible)
            return;

        _navegador.Visible = true;
        _painelCarregamento.Visible = false;
        _navegador.Focus();
    }

    private void AoFalharProcessoNavegador(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        if (Encerrando)
            return;

        if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited)
        {
            MostrarErroEFechar("A interface do SMARtb SVD foi encerrada inesperadamente e o sistema precisa ser aberto novamente.");
            return;
        }

        if (e.ProcessFailedKind != CoreWebView2ProcessFailedKind.RenderProcessExited
            && e.ProcessFailedKind != CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            return;

        var resposta = MessageBox.Show(this,
            "A interface do SMARtb SVD parou de responder. Deseja recarregá-la?",
            TituloPadrao, MessageBoxButtons.YesNo, MessageBoxIcon.Warning);

        if (resposta == DialogResult.Yes)
            _navegador.Reload();
    }

    private void AoPerderServidor()
    {
        if (Encerrando)
            return;

        MostrarErroEFechar(
            "O serviço interno do SMARtb SVD foi encerrado inesperadamente e o sistema precisa ser aberto novamente.\n\n" +
            $"Detalhes técnicos podem ser encontrados em:\n{_servidor.ArquivoLog}");
    }

    private void ExecutarNaJanela(Action acao)
    {
        if (!IsHandleCreated || Encerrando)
            return;

        try
        {
            BeginInvoke(acao);
        }
        catch (InvalidOperationException)
        {
        }
    }

    private void MostrarErroEFechar(string mensagem)
    {
        if (Encerrando)
            return;

        MessageBox.Show(this, mensagem, TituloPadrao, MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _cancelamento.Cancel();
        _navegador.Dispose();
        _servidor.Dispose();
        base.OnFormClosed(e);
    }
}
