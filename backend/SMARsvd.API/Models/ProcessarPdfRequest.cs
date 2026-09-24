namespace SMARsvd.API.Models;

public class ProcessarPdfRequest
{
    public IFormFile ArquivoPdf { get; set; } = null!;
    public Guid LayoutId { get; set; }
    public decimal Amostragem { get; set; }
}