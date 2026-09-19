using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialLayoutMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Layouts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Cliente = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    NomeModelo = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Versao = table.Column<int>(type: "int", nullable: false),
                    Orientacao = table.Column<int>(type: "int", nullable: false),
                    FormatoPapel = table.Column<int>(type: "int", nullable: false),
                    LarguraPaginaMm = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    AlturaPaginaMm = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    QuantidadePaginasPadrao = table.Column<int>(type: "int", nullable: false),
                    NomeArquivoModelo = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Layouts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaginasModelo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LayoutClienteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NumeroPagina = table.Column<int>(type: "int", nullable: false),
                    ImagemBase64 = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaginasModelo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaginasModelo_Layouts_LayoutClienteId",
                        column: x => x.LayoutClienteId,
                        principalTable: "Layouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QueriesValidacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LayoutClienteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Nome = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Sql = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QueriesValidacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QueriesValidacao_Layouts_LayoutClienteId",
                        column: x => x.LayoutClienteId,
                        principalTable: "Layouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RegioesCampos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LayoutClienteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NomeCampo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    XMm = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    YMm = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    LarguraMm = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    AlturaMm = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    Pagina = table.Column<int>(type: "int", nullable: false),
                    EhIdentificadorPrimeiraPagina = table.Column<bool>(type: "bit", nullable: false),
                    TextoEsperadoIdentificador = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegioesCampos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegioesCampos_Layouts_LayoutClienteId",
                        column: x => x.LayoutClienteId,
                        principalTable: "Layouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RegrasValidacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QueryValidacaoId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampoRetornado = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Operador = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CampoCarne = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegrasValidacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegrasValidacao_QueriesValidacao_QueryValidacaoId",
                        column: x => x.QueryValidacaoId,
                        principalTable: "QueriesValidacao",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaginasModelo_LayoutClienteId",
                table: "PaginasModelo",
                column: "LayoutClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_QueriesValidacao_LayoutClienteId",
                table: "QueriesValidacao",
                column: "LayoutClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_RegioesCampos_LayoutClienteId",
                table: "RegioesCampos",
                column: "LayoutClienteId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasValidacao_QueryValidacaoId",
                table: "RegrasValidacao",
                column: "QueryValidacaoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaginasModelo");

            migrationBuilder.DropTable(
                name: "RegioesCampos");

            migrationBuilder.DropTable(
                name: "RegrasValidacao");

            migrationBuilder.DropTable(
                name: "QueriesValidacao");

            migrationBuilder.DropTable(
                name: "Layouts");
        }
    }
}
