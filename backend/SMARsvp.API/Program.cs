using Microsoft.EntityFrameworkCore;
using SMARsvp.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Obter a string de conexão configurada no appsettings.json
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// 2. Registar o SMARsvpDbContext usando o provedor SQL Server
// Substitua o .UseSqlServer(...) por .UseSqlite(...)
builder.Services.AddDbContext<SMARsvpDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("PermitirFrontend");

app.UseAuthorization();

app.MapControllers();



// --- BLOCO PARA REINICIAR O BANCO NA INICIALIZAÇÃO ---
if (false)
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<SMARsvpDbContext>();

        // 1. Apaga fisicamente o banco de dados existente e todos os seus dados
        dbContext.Database.EnsureDeleted();

        // 2. Recria o banco e todas as tabelas com base nas entidades mapeadas
        dbContext.Database.EnsureCreated();

        // Dica: Se preferir aplicar via migrations em vez de EnsureCreated(), use:
        // dbContext.Database.Migrate();
    }
}
// -----------------------------------------------------

app.Run();

app.Run();