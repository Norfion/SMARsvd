using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMARsvd.Infrastructure.Migrations
{
    public partial class AdicionarUsuarioLogs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Usuario",
                table: "Logs",
                type: "TEXT",
                maxLength: 64,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Usuario",
                table: "Logs");
        }
    }
}
