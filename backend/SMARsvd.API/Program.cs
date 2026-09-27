using Microsoft.EntityFrameworkCore;
using SMARsvd.Application.Interfaces;
using SMARsvd.Application.Services;
using SMARsvd.Infrastructure.Data;
using SMARsvd.Infrastructure.Services;
using SMARsvd.API.Middlewares;
using SMARsvd.API.Services;
using SMARsvd.Infrastructure.Factories;


var builder = WebApplication.CreateBuilder(args);

// 1. Obter a string de conexão configurada no appsettings.json
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// 2. Registrar o SMARsvdDbContext usando SQLite
builder.Services.AddDbContext<SMARsvdDbContext>(options =>
    options.UseSqlite(connectionString));

// 3. Registrar os Serviços no Container de Injeção de Dependência (DI)
builder.Services.AddScoped<IExtratorPdfService, ExtratorPdfService>();
builder.Services.AddScoped<ProcessadorCarnesService>();
builder.Services.AddScoped<ILogService, LogService>();
builder.Services.AddScoped<IAuditoriaValidacaoService, AuditoriaValidacaoService>();
builder.Services.AddScoped<IExecutorBancoDados, SqlServerExecutorService>();
builder.Services.AddScoped<IBancoDadosExecutorFactory, BancoDadosExecutorFactory>();
builder.Services.AddScoped<IAuditoriaValidacaoService, AuditoriaValidacaoService>();
builder.Services.AddSingleton<IValidadorConsultaSql, ValidadorConsultaSqlServer>();

// Mantém o OCR como Singleton para não recarregar o modelo do Tesseract em toda requisição
builder.Services.AddSingleton<IOcrService, OcrService>();

// Autenticação na rede Windows e isolamento dos dados temporários por usuário
builder.Services.AddSingleton<IAutenticacaoRedeService, AutenticacaoWindowsService>();
builder.Services.AddSingleton<ISessaoUsuarioService, SessaoUsuarioService>();
builder.Services.AddSingleton<IPastaTemporariaService, PastaTemporariaService>();
builder.Services.AddHostedService<LimpezaDadosTemporariosService>();

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

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("PermitirFrontend");

app.UseMiddleware<SessaoUsuarioMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();