using Microsoft.EntityFrameworkCore;
using SMARsvp.Domain.Entities;

namespace SMARsvp.Infrastructure.Data;

public class SMARsvpDbContext : DbContext
{
    public SMARsvpDbContext(DbContextOptions<SMARsvpDbContext> options) : base(options)
    {
    }

    public DbSet<LayoutCliente> Layouts { get; set; } = null!;
    public DbSet<RegiaoCampo> RegioesCampos { get; set; } = null!;
    public DbSet<QueryValidacao> QueriesValidacao { get; set; } = null!;
    public DbSet<RegraValidacao> RegrasValidacao { get; set; } = null!;
    public DbSet<PaginaModeloImagem> PaginasModelo { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuração da Tabela de Layout
        modelBuilder.Entity<LayoutCliente>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Cliente).IsRequired().HasMaxLength(150);
            entity.Property(e => e.NomeModelo).IsRequired().HasMaxLength(150);
            entity.Property(e => e.LarguraPaginaMm).HasPrecision(10, 2);
            entity.Property(e => e.AlturaPaginaMm).HasPrecision(10, 2);

            // Relacionamentos 1:N com exclusão em cascata (se deletar o layout, limpa os filhos)
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

        // Configuração da Tabela de Regiões / Coordenadas
        modelBuilder.Entity<RegiaoCampo>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.NomeCampo).IsRequired().HasMaxLength(100);
            entity.Property(e => e.XMm).HasPrecision(10, 2);
            entity.Property(e => e.YMm).HasPrecision(10, 2);
            entity.Property(e => e.LarguraMm).HasPrecision(10, 2);
            entity.Property(e => e.AlturaMm).HasPrecision(10, 2);
            entity.Property(e => e.TextoEsperadoIdentificador).HasMaxLength(250);
        });

        // Configuração de Queries e Regras
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
        });

        // Configuração de Imagens de Gabarito
        modelBuilder.Entity<PaginaModeloImagem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ImagemBase64).IsRequired();
        });
    }
}