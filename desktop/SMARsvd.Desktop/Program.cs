using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace SMARsvd.Desktop;

internal static class Program
{
    private const int SW_RESTORE = 9;

    [STAThread]
    private static void Main()
    {
        var caminhos = new CaminhosAplicacao();

        // Uma instância por pasta do pacote: abrir o atalho de novo apenas traz a janela existente para frente
        using var instanciaUnica = new Mutex(true, ObterNomeInstancia(caminhos.PastaRaiz), out bool primeiraInstancia);
        if (!primeiraInstancia)
        {
            AtivarInstanciaExistente();
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => MostrarErroInesperado(e.Exception);

        Application.Run(new JanelaPrincipal(caminhos));
    }

    private static string ObterNomeInstancia(string pastaRaiz)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(pastaRaiz.ToUpperInvariant()));
        return $"Local\\SMARsvd_{Convert.ToHexString(hash, 0, 12)}";
    }

    private static void AtivarInstanciaExistente()
    {
        using var atual = Process.GetCurrentProcess();
        foreach (var processo in Process.GetProcessesByName(atual.ProcessName))
        {
            using (processo)
            {
                if (processo.Id == atual.Id || processo.MainWindowHandle == IntPtr.Zero)
                    continue;

                if (IsIconic(processo.MainWindowHandle))
                    ShowWindow(processo.MainWindowHandle, SW_RESTORE);
                SetForegroundWindow(processo.MainWindowHandle);
                return;
            }
        }
    }

    private static void MostrarErroInesperado(Exception excecao)
    {
        MessageBox.Show(
            $"Ocorreu um erro inesperado no SMARtb SVD.\n\n{excecao.Message}",
            "SMARtb SVD", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);
}
