import chalk from "chalk";

export const messages = {
  createPr: "📝 Create the PR?",
  copyToClipboard: "📋 Copy to the clipboard?",
  rewritePrompt: chalk.yellow("🔄 Do you want to re-write the prompt?"),
  addContext: chalk.yellow("📚 Do you want to add any context to the prompt?"),
  addJiraTicket: chalk.yellow(
    "🎫 Do you want to add a Jira ticket description?",
  ),
  selectJiraTicket: chalk.yellow(
    "🔍 Select the Jira ticket to include in the PR description:",
  ),
  enterJiraTicket: chalk.cyan("🔢 Enter the Jira ticket number:"),
  enterCustomPrompt: chalk.cyan("✏️ Enter your custom prompt:"),
  enterExtraContext: chalk.cyan("📝 Enter your extra context:"),
};
