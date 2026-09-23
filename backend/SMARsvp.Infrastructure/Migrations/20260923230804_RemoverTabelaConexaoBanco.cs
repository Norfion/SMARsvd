using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoverTabelaConexaoBanco : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConexoesBanco");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConexoesBanco",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    LayoutClienteId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Porta = table.Column<int>(type: "INTEGER", nullable: false),
                    Provedor = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Senha = table.Column<string>(type: "TEXT", maxLength: 250, nullable: true),
                    Servidor = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                    Usuario = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConexoesBanco", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConexoesBanco_Layouts_LayoutClienteId",
                        column: x => x.LayoutClienteId,
                        principalTable: "Layouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConexoesBanco_LayoutClienteId",
                table: "ConexoesBanco",
                column: "LayoutClienteId",
                unique: true);
        }
    }
}
