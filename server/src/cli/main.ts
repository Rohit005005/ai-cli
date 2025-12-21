import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";

import { Command } from "commander";
import { login } from "./commands/auth/login.ts";

dotenv.config();

async function main() {
  console.log(
    chalk.cyan(
      figlet.textSync("AI CLI", {
        font: "Standard",
        horizontalLayout: "default",
      }),
    ),
  );

  console.log(chalk.red("A cli based AI tool !! \n"));

  const program = new Command("ai-cli");

  program
    .version("0.0.1")
    .description("AI CLI tool for ai stuff in terminal !!")
    .addCommand(login);

  program.action(() => {
    program.help();
  });

  program.parse();
}
main().catch((error) => {
  console.log(chalk.red("Error running AI CLI : ", error));
  process.exit(1);
});
