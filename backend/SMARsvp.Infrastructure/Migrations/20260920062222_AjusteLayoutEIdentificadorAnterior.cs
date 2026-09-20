using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AjusteLayoutEIdentificadorAnterior : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FormatoPapel",
                table: "Layouts");

            migrationBuilder.DropColumn(
                name: "Orientacao",
                table: "Layouts");

            migrationBuilder.DropColumn(
                name: "QuantidadePaginasPadrao",
                table: "Layouts");

            migrationBuilder.AddColumn<string>(
                name: "IdentificadorAnterior",
                table: "RegioesCampos",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdentificadorAnterior",
                table: "RegioesCampos");

            migrationBuilder.AddColumn<int>(
                name: "FormatoPapel",
                table: "Layouts",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Orientacao",
                table: "Layouts",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "QuantidadePaginasPadrao",
                table: "Layouts",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }
    }
}
