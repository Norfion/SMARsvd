using Microsoft.EntityFrameworkCore;
using SMARsvd.Application.Interfaces;
using SMARsvd.Application.Services;
using SMARsvd.Infrastructure.Data;
using SMARsvd.Infrastructure.Services;
using SMARsvd.API.Middlewares;
<<<<<<< HEAD
using SMARsvd.API.Services;
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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
<<<<<<< HEAD
builder.Services.AddSingleton<IValidadorConsultaSql, ValidadorConsultaSqlServer>();
=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38

// Mantém o OCR como Singleton para não recarregar o modelo do Tesseract em toda requisição
builder.Services.AddSingleton<IOcrService, OcrService>();

<<<<<<< HEAD
// Autenticação na rede Windows e isolamento dos dados temporários por usuário
builder.Services.AddSingleton<IAutenticacaoRedeService, AutenticacaoWindowsService>();
builder.Services.AddSingleton<ISessaoUsuarioService, SessaoUsuarioService>();
builder.Services.AddSingleton<IPastaTemporariaService, PastaTemporariaService>();
builder.Services.AddHostedService<LimpezaDadosTemporariosService>();

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
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

<<<<<<< HEAD
app.UseMiddleware<SessaoUsuarioMiddleware>();

=======
>>>>>>> 92997767685e1ab7cc51fdf3210c9a0ede5d0c38
app.UseAuthorization();

app.MapControllers();

app.Run();