namespace SMARsvd.Desktop;

// Todos os caminhos partem da pasta onde o SMARsvd.exe está, para que o pacote funcione em qualquer local
// em que for descompactado:
//
// SMARsvd/
// ├── SMARsvd.exe
// ├── app/servidor/        Servidor (API) com a interface compilada em wwwroot e o modelo do OCR em tessdata
// ├── app/webview2/        (opcional) WebView2 Runtime "Fixed Version", para máquinas sem o runtime instalado
// ├── database/            Banco interno (criado na primeira execução) e pasta temp/ dos usuários
// └── logs/                Saída do servidor, para suporte
public sealed class CaminhosAplicacao
{
    public string PastaRaiz { get; }
    public string PastaServidor => Path.Combine(PastaRaiz, "app", "servidor");
    public string ExecutavelServidor => Path.Combine(PastaServidor, "SMARsvd.API.exe");
    public string PastaTessdata => Path.Combine(PastaServidor, "tessdata");
    public string PastaWebView2Fixo => Path.Combine(PastaRaiz, "app", "webview2");
    public string PastaBanco => Path.Combine(PastaRaiz, "database");
    public string ArquivoBanco => Path.Combine(PastaBanco, "SMARtb_SVD_dados.db");
    public string PastaTemporaria => Path.Combine(PastaBanco, "temp");
    public string PastaLogs => Path.Combine(PastaRaiz, "logs");

    // Cache e dados do navegador embutido ficam no perfil do usuário, que sempre tem permissão de escrita
    public string PastaDadosNavegador => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SMARsvd", "WebView2");

    public CaminhosAplicacao()
    {
        string? caminhoExecutavel = Environment.ProcessPath;
        PastaRaiz = !string.IsNullOrEmpty(caminhoExecutavel)
            ? Path.GetDirectoryName(caminhoExecutavel)!
            : AppContext.BaseDirectory;
    }
}
