import { spawn } from "child_process";
import chalk from "chalk";
import prompts from "prompts"; // Import prompts
import { callChatGPTApi } from "./ChatGPTApi";
import dotenv from "dotenv";
import {getStagedFiles, getStagedGitDiff} from "./git";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import ora from 'ora'

dotenv.config();

const argv = yargs(hideBin(process.argv))
    .option("dir", {
      alias: "d",
      description: "Specify the directory of the git repository",
      type: "string",
      default: process.cwd(),
    })
    .help()
    .alias("help", "h")
    .parseSync();

process.chdir(argv.dir);

async function generateCommitMessage(diff: string): Promise<string> {
  if (!diff.trim()) {
    console.log(chalk.yellow("No changes detected in staged files."));
    return "No changes to commit.";
  }

  const spinner = ora(chalk.blue('Generating commit message...')).start();

  const prompt =
      "Please generate a concise commit message based on the following changes, following the Conventional Commits specification";
  try {
    const commitMessage = await callChatGPTApi(prompt, diff);
    spinner.succeed(chalk.blue('Commit message generated'));
    return commitMessage;
  } catch (error) {
    spinner.fail('Failed to generate commit message.');
    console.error(chalk.red("Failed to generate commit message:"), error);
    process.exit(1);
  }
}

async function commitChanges(commitMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Remove starting and ending single or triple backticks from the commit message
    const cleanedCommitMessage = commitMessage.replace(/^`{1,3}|`{1,3}$/g, "");

    const commit = spawn("git", ["commit", "-m", cleanedCommitMessage], {
      stdio: "inherit",
    });

    commit.on("close", (code) => {
      if (code === 0) {
        console.log(chalk.green("Changes committed successfully."));
        resolve();
      } else {
        console.error(
          chalk.red(`Failed to commit changes with exit code: ${code}`),
        );
        reject(new Error(`git commit command failed with exit code ${code}`));
      }
    });

    commit.on("error", (error) => {
      console.error(chalk.red("Failed to commit changes:"), error);
      reject(error);
    });
  });
}

async function main() {
  const diff = await getStagedGitDiff(argv.dir);
  const stagedFiles = await getStagedFiles(argv.dir);

  if (diff) {
    if (stagedFiles.length > 0) {
      const header = "Staged files to be committed:";
      const totalWidth = 50; // Total width for the header/footer lines including border
      const borderWidth = 2; // For the left and right border characters "|"
      const contentWidth = totalWidth - borderWidth; // Width available for content

      console.log(chalk.blueBright("┌" + "─".repeat(contentWidth) + "┐"));

      // Calculate padding dynamically for the header
      const paddingLength = (contentWidth - header.length) / 2;
      const padding = " ".repeat(Math.floor(paddingLength));
      const paddingExtra = header.length % 2 !== 0 ? " " : ""; // For odd-length headers

      console.log(chalk.blueBright("│") + padding + chalk.bold(header) + padding + paddingExtra + chalk.blueBright("│"));

      console.log(chalk.blueBright("├" + "─".repeat(contentWidth) + "┤"));

      // Print each staged file with appropriate padding
      stagedFiles.forEach(file => {
        const filePaddingLength = contentWidth - file.length - 1; // -1 for the space after the file name
        const filePadding = " ".repeat(Math.max(0, filePaddingLength)); // Prevent negative padding values
        console.log(chalk.blueBright("│ ") + chalk.yellowBright(file) + filePadding + chalk.blueBright("│"));
      });

      console.log(chalk.blueBright("└" + "─".repeat(contentWidth) + "┘"));
      console.log(""); // Add an empty line for better readability
    } else {
      console.log(chalk.yellow("No files are staged for commit."));
    }

    const commitMessage = await generateCommitMessage(diff);
    console.log(chalk.greenBright("Suggested commit message:"));
    console.log(chalk.cyanBright(commitMessage));
  



    // Prompt whether to commit with the suggested message
    const response = await prompts({
      type: "toggle",
      name: "value",
      message: "Do you want to commit with the above message?",
      initial: true,
      active: "yes",
      inactive: "no",
    });

    if (response.value) {
      await commitChanges(commitMessage);
    } else {
      console.log(chalk.yellow("Commit aborted by user."));
    }
  } else {
    console.log(chalk.red("No staged changes found."));
  }
}

main().catch((error) => {
  console.error(chalk.red("Unexpected error:"), error);
  process.exit(1);
});
