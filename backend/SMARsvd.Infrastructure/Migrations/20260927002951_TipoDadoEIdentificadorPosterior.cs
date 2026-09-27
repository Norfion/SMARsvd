using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvd.Infrastructure.Migrations
{
    public partial class TipoDadoEIdentificadorPosterior : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FormatoPersonalizado",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdentificadorPosterior",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoDado",
                table: "RegioesCampos",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FormatoPersonalizado",
                table: "RegioesCampos");

            migrationBuilder.DropColumn(
                name: "IdentificadorPosterior",
                table: "RegioesCampos");

            migrationBuilder.DropColumn(
                name: "TipoDado",
                table: "RegioesCampos");
        }
    }
}
