using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AjusteEstruturaPaginas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RegrasValidacao_QueryValidacaoId",
                table: "RegrasValidacao");

            migrationBuilder.RenameColumn(
                name: "TextoEsperadoIdentificador",
                table: "RegioesCampos",
                newName: "TextoEsperadoPagina");

            migrationBuilder.RenameColumn(
                name: "EhIdentificadorPrimeiraPagina",
                table: "RegioesCampos",
                newName: "EhIdentificadorPagina");

            migrationBuilder.AddColumn<bool>(
                name: "EhIdentificadorInicio",
                table: "RegioesCampos",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "IdentificadorPagina",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TextoEsperadoInicio",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 250,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegrasValidacao_QueryValidacaoId_CampoRetornado_Operador_CampoCarne",
                table: "RegrasValidacao",
                columns: new[] { "QueryValidacaoId", "CampoRetornado", "Operador", "CampoCarne" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RegrasValidacao_QueryValidacaoId_CampoRetornado_Operador_CampoCarne",
                table: "RegrasValidacao");

            migrationBuilder.DropColumn(
                name: "EhIdentificadorInicio",
                table: "RegioesCampos");

            migrationBuilder.DropColumn(
                name: "IdentificadorPagina",
                table: "RegioesCampos");

            migrationBuilder.DropColumn(
                name: "TextoEsperadoInicio",
                table: "RegioesCampos");

            migrationBuilder.RenameColumn(
                name: "TextoEsperadoPagina",
                table: "RegioesCampos",
                newName: "TextoEsperadoIdentificador");

            migrationBuilder.RenameColumn(
                name: "EhIdentificadorPagina",
                table: "RegioesCampos",
                newName: "EhIdentificadorPrimeiraPagina");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasValidacao_QueryValidacaoId",
                table: "RegrasValidacao",
                column: "QueryValidacaoId");
        }
    }
}
