using Microsoft.EntityFrameworkCore;
using SMARsvd.Domain.Entities;

namespace SMARsvd.Infrastructure.Data;

public class SMARsvdDbContext : DbContext
{
    public SMARsvdDbContext(DbContextOptions<SMARsvdDbContext> options) : base(options) { }

    public DbSet<LayoutCliente> Layouts { get; set; } = null!;
    public DbSet<RegiaoCampo> RegioesCampos { get; set; } = null!;
    public DbSet<QueryValidacao> QueriesValidacao { get; set; } = null!;
    public DbSet<RegraValidacao> RegrasValidacao { get; set; } = null!;
    public DbSet<PaginaModeloImagem> PaginasModelo { get; set; } = null!;
    public DbSet<LogSistema> Logs { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<LayoutCliente>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Cliente).IsRequired().HasMaxLength(150);
            entity.Property(e => e.NomeModelo).IsRequired().HasMaxLength(150);
            entity.Property(e => e.LarguraPaginaMm).HasPrecision(10, 2);
            entity.Property(e => e.AlturaPaginaMm).HasPrecision(10, 2);

            entity.HasMany(e => e.Campos)
                  .WithOne(e => e.LayoutCliente)
                  .HasForeignKey(e => e.LayoutClienteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.QueriesValidacao)
                  .WithOne(e => e.LayoutCliente)
                  .HasForeignKey(e => e.LayoutClienteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.PaginasModelo)
                  .WithOne(e => e.LayoutCliente)
                  .HasForeignKey(e => e.LayoutClienteId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RegiaoCampo>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.NomeCampo).IsRequired().HasMaxLength(100);
            entity.Property(e => e.XMm).HasPrecision(10, 2);
            entity.Property(e => e.YMm).HasPrecision(10, 2);
            entity.Property(e => e.LarguraMm).HasPrecision(10, 2);
            entity.Property(e => e.AlturaMm).HasPrecision(10, 2);

            entity.Property(e => e.TipoClassificacao).IsRequired();
            entity.Property(e => e.TextoEsperadoDocumento).HasMaxLength(250);
            entity.Property(e => e.TextoEsperadoPagina).HasMaxLength(250);
            entity.Property(e => e.IdentificadorPagina).HasMaxLength(100);
            entity.Property(e => e.IdentificadorAnterior).HasMaxLength(150);
<<<<<<< HEAD
            entity.Property(e => e.IdentificadorPosterior).HasMaxLength(150);
            entity.Property(e => e.TipoDado).IsRequired();
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
        });

        modelBuilder.Entity<QueryValidacao>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nome).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Sql).IsRequired();

            entity.HasMany(e => e.Regras)
                  .WithOne(e => e.QueryValidacao)
                  .HasForeignKey(e => e.QueryValidacaoId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RegraValidacao>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CampoRetornado).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Operador).IsRequired().HasMaxLength(10);
            entity.Property(e => e.CampoCarne).IsRequired().HasMaxLength(100);

            entity.HasIndex("QueryValidacaoId", "CampoRetornado", "Operador", "CampoCarne").IsUnique();
        });

        modelBuilder.Entity<PaginaModeloImagem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ImagemBase64).IsRequired();
        });

        modelBuilder.Entity<LogSistema>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Tipo).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Mensagem).IsRequired();
            entity.Property(e => e.Origem).HasMaxLength(250);

            entity.HasIndex(e => e.DataHora);
            entity.HasIndex(e => e.Tipo);
        });
    }
}