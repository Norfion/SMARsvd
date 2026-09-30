using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using SMARsvd.Application.Interfaces;
using SMARsvd.Application.Services;
using SMARsvd.Infrastructure.Data;
using SMARsvd.Infrastructure.Services;
using SMARsvd.API.Middlewares;
using SMARsvd.API.Services;
using SMARsvd.Infrastructure.Factories;


var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(opcoes => opcoes.AddServerHeader = false);

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
builder.Services.AddSingleton<IValidadorConsultaSql, ValidadorConsultaSqlServer>();

// Mantém o OCR como Singleton para não recarregar o modelo do Tesseract em toda requisição
builder.Services.AddSingleton<IOcrService, OcrService>();

// Autenticação na rede Windows e isolamento dos dados temporários por usuário
builder.Services.AddSingleton<IAutenticacaoRedeService, AutenticacaoWindowsService>();
builder.Services.AddSingleton<ISessaoUsuarioService, SessaoUsuarioService>();
builder.Services.AddSingleton<IPastaTemporariaService, PastaTemporariaService>();
builder.Services.AddSingleton<IFilaProcessamentoService, FilaProcessamentoService>();
builder.Services.AddHostedService<LimpezaDadosTemporariosService>();
builder.Services.AddSingleton<LimitadorTentativasLogin>();
builder.Services.AddSingleton<SenhaExclusaoLayoutService>();

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

// Cria o banco interno na primeira execução (ex.: pacote desktop recém-descompactado) e aplica migrations pendentes
using (var escopo = app.Services.CreateScope())
{
    var contexto = escopo.ServiceProvider.GetRequiredService<SMARsvdDbContext>();
    contexto.Database.Migrate();
}

// No modo WAL as leituras não bloqueiam as gravações (e vice-versa), permitindo que vários usuários
// gravem logs enquanto outros consultam o banco. A configuração fica persistida no próprio arquivo.
try
{
    using var escopo = app.Services.CreateScope();
    var contexto = escopo.ServiceProvider.GetRequiredService<SMARsvdDbContext>();
    contexto.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Não foi possível ativar o modo WAL no banco SQLite.");
}

app.UseMiddleware<CabecalhosSegurancaMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// O SMARsvd.exe inicia o servidor numa porta escolhida pelo próprio sistema operacional (porta 0) e lê o endereço
// real nesta linha, sem a janela entre "achar uma porta livre" e ocupá-la em que outro programa poderia tomá-la
if (app.Configuration.GetValue<bool>("SMARSVD_ANUNCIAR_ENDERECO"))
{
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        foreach (var endereco in app.Urls)
            Console.WriteLine($"SMARSVD_ENDERECO_SERVIDOR={endereco}");
    });
}

// A pasta wwwroot só existe no pacote distribuído, onde o próprio servidor entrega a interface já compilada
if (!string.IsNullOrEmpty(app.Environment.WebRootPath))
{
    var tiposConteudo = new FileExtensionContentTypeProvider();
    // O worker do PDF.js é um módulo .mjs, que precisa ser servido como JavaScript
    tiposConteudo.Mappings[".mjs"] = "text/javascript";

    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = tiposConteudo });
}

// Em produção a interface é servida pelo próprio servidor (ou pelo proxy do Vite), sempre na mesma origem
if (app.Environment.IsDevelopment())
    app.UseCors("PermitirFrontend");

app.UseMiddleware<SessaoUsuarioMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();