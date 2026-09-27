using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvd.Infrastructure.Migrations
{
    public partial class RemoverFormatoPersonalizado : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FormatoPersonalizado",
                table: "RegioesCampos");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FormatoPersonalizado",
                table: "RegioesCampos",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }
    }
}
