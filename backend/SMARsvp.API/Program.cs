using Microsoft.EntityFrameworkCore;
using SMARsvp.Application.Interfaces;
using SMARsvp.Application.Services;
using SMARsvp.Infrastructure.Data;
using SMARsvp.Infrastructure.Services;
using SMARsvp.API.Middlewares;

var builder = WebApplication.CreateBuilder(args);

// 1. Obter a string de conexão configurada no appsettings.json
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// 2. Registrar o SMARsvpDbContext usando SQLite
builder.Services.AddDbContext<SMARsvpDbContext>(options =>
    options.UseSqlite(connectionString));

// 3. Registrar os Serviços no Container de Injeção de Dependência (DI)
builder.Services.AddScoped<IExtratorPdfService, ExtratorPdfService>();
builder.Services.AddScoped<IOcrService, OcrService>();
builder.Services.AddScoped<ProcessadorCarnesService>();
builder.Services.AddScoped<ILogService, LogService>();

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

app.UseAuthorization();

app.MapControllers();

app.Run();