using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AtualizacaoIdentificadoresDinamicos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EhIdentificadorInicio",
                table: "RegioesCampos");

            migrationBuilder.RenameColumn(
                name: "TextoEsperadoInicio",
                table: "RegioesCampos",
                newName: "TextoEsperadoDocumento");

            migrationBuilder.RenameColumn(
                name: "EhIdentificadorPagina",
                table: "RegioesCampos",
                newName: "TipoClassificacao");

            migrationBuilder.AlterColumn<string>(
                name: "IdentificadorPagina",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 100);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TipoClassificacao",
                table: "RegioesCampos",
                newName: "EhIdentificadorPagina");

            migrationBuilder.RenameColumn(
                name: "TextoEsperadoDocumento",
                table: "RegioesCampos",
                newName: "TextoEsperadoInicio");

            migrationBuilder.AlterColumn<string>(
                name: "IdentificadorPagina",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EhIdentificadorInicio",
                table: "RegioesCampos",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }
    }
}
