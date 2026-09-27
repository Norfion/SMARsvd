using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvd.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarTabelaLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Mensagem = table.Column<string>(type: "TEXT", nullable: false),
                    Origem = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                    DataHora = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StackTrace = table.Column<string>(type: "TEXT", nullable: true),
                    Detalhes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Logs_DataHora",
                table: "Logs",
                column: "DataHora");

            migrationBuilder.CreateIndex(
                name: "IX_Logs_Tipo",
                table: "Logs",
                column: "Tipo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Logs");
        }
    }
}
