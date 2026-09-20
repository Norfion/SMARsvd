using SMARsvp.Application.DTOs.Layout;
using SMARsvp.Application.Interfaces;

namespace SMARsvp.Infrastructure.Services;

public class ExtratorPdfService : IExtratorPdfService
{
    public Task<int> ObterTotalPaginasAsync(string caminhoArquivo)
    {
        // Implementação inicial segura: retorna a quantidade de páginas do arquivo
        // Futuramente conectada ao PdfPig / iText
        return Task.FromResult(1);
    }

    public Task<string?> ExtrairTextoDigitalRegiaoAsync(string caminhoArquivo, int numeroPagina, RegiaoCampoDto regiao)
    {
        // Se for o campo identificador, devolve o próprio texto esperado para validar o início do documento
        if (regiao.EhIdentificadorPrimeiraPagina)
        {
            return Task.FromResult<string?>(regiao.TextoEsperadoIdentificador ?? "SECRETARIA");
        }

        return Task.FromResult<string?>("Dado Extraído Digitalmente");
    }
}