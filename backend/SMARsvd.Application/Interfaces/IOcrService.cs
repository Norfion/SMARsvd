namespace SMARsvd.Application.Interfaces;

public interface IOcrService
{
    // Interface preparada para futura integração com IA/Visão Computacional
    Task<string> ExtrairTextoPorOcrAsync(string caminhoArquivo, int numeroPagina, decimal x, decimal y, decimal largura, decimal altura);
<<<<<<< HEAD

    // Descarta o documento e a página renderizada mantidos em cache para o arquivo
    void LiberarArquivo(string caminhoArquivo);
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
}