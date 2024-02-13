import { Octokit } from "@octokit/rest";
import moment from "moment";
import { exec } from "child_process";
import * as fs from "fs";
import dotenv from "dotenv";
import chalk from "chalk";
import prompts from "prompts";
import axios from "axios";

dotenv.config();

// Register SIGINT handler
process.on("SIGINT", () => {
  console.log(chalk.red("\nExiting gracefully..."));
  process.exit(0);
});

interface PullRequest {
  title: string;
  html_url: string;
  closed_at: string;
}

const PROMPT = `
Please create a short, concise summary of each of the following PRs, so that I can put it in my hypedoc to reference in the future.

It should:
- Emphasise the impact and benefits
- Be clear and concise
- Have a URL of the PR at the end of the line in brackets so I can click through to the PR (NOT a hyperlink, just the URL on its own)
- Be in reverse chronological order (most recent first)
- Be in plaintext, not markdown

Please follow the following example as a reference for desired format:
Feb 10, 2024:
- Successfully led the development of Project X's core module, improving system efficiency by 20%.
- Initiated and completed a code refactoring for the Legacy System, enhancing maintainability.
- Collaborated on the Integration Initiative, ensuring seamless connection between System A and B.
- Acted as the interim lead for the Deployment Team during critical release phases.

Jan 25, 2024:
- Spearheaded the documentation overhaul for Project Y, setting a new standard for project clarity.
- Managed cross-departmental teams to kickstart the Beta Launch of the New Platform.
- Coordinated with the Design Team to implement a new UI/UX for the Customer Portal.
`;

export async function callChatGPTApi(
  systemContent: string,
  userContent: string,
): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-0125-preview", // Ensure this is the correct model identifier
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } },
    );

    // Assuming the API response structure matches the expected format.
    // You might need to adjust this based on the actual response format.
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error calling ChatGPT API:", error);
    throw error; // Rethrow or handle as needed
  }
}

class PRSummarizer {
  private octokit: Octokit;
  private username: string | undefined;
  private sinceDate: string;

  constructor() {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.username = process.env.GITHUB_USERNAME;
    // Initialize sinceDate with a temporary value, will be updated based on user input
    this.sinceDate = moment().format();
  }

  private async setSinceDate(): Promise<void> {
    const defaultWeeks = 2;
    const response = await prompts({
      type: "number",
      name: "value",
      message: chalk.yellow("How many weeks ago should PRs be fetched from?"),
      initial: 2,
      // validate: (value) =>
      // value < 1 ? `Please enter a positive number.` : true,
    });

    this.sinceDate = moment()
      .subtract(response.value || defaultWeeks, "weeks")
      .format();
  }

  private async fetchMergedPRs(): Promise<PullRequest[]> {
    if (!this.username) {
      throw new Error("GitHub username is not set in environment variables.");
    }

    const searchResponse = await this.octokit.search.issuesAndPullRequests({
      q: `is:pr author:${this.username} is:merged`,
      sort: "created",
      order: "desc",
      per_page: 100,
    });

    return searchResponse.data.items.filter((pr) =>
      moment(pr.closed_at).isAfter(this.sinceDate),
    ) as PullRequest[];
  }

  private async summarizePRs(prs: PullRequest[]): Promise<void> {
    // Convert PRs to a format suitable for prompts
    const choices = prs.map((pr, index) => ({
      title: `${pr.title} (merged ${moment(pr.closed_at).format("Do MMM YYYY")})`,
      value: index,
      selected: true,
    }));

    const response = await prompts({
      type: "multiselect",
      name: "selectedPRs",
      message: chalk.yellow("Select PRs to fetch summaries for:"),
      choices,
      // hint: "- Space to select. Return to submit",
    });

    // Filter PRs based on selected indices
    const selectedPRs = response.selectedPRs.map((index: number) => prs[index]);

    if (selectedPRs.length === 0) {
      console.log(chalk.yellow("No PRs selected for summarization."));
      return;
    }

    // Proceed with summarization for selected PRs
    const prsData: string = JSON.stringify(selectedPRs);
    const tempFilePath: string = "./temp_prs_data.json";
    fs.writeFileSync(tempFilePath, prsData);

    try {
      const hypedocSummaries = await callChatGPTApi(PROMPT, tempFilePath);
      console.log(chalk.green("🚀 Hypedoc summaries generated:\n\n"));
      console.log(hypedocSummaries);
      fs.unlinkSync(tempFilePath);
    } catch (error) {
      console.error(chalk.red(`Error executing command: ${error}`));
    }
  }

  private executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`exec error: ${error}`);
          return;
        }
        if (stderr) {
          console.log(chalk.gray(`stderr: ${stderr}`));
        }
        resolve(stdout);
      });
    });
  }

  public async run(): Promise<void> {
    console.log(chalk.cyan("Fetching merged PRs..."));
    await this.setSinceDate();
    try {
      const prs = await this.fetchMergedPRs();
      console.log(chalk.blue(`Found [${prs.length}] pull requests...`));
      await this.summarizePRs(prs);
    } catch (error) {
      console.error(chalk.red(`Failed to process PRs: ${error}`));
    }
  }
}

const summarizer = new PRSummarizer();
summarizer.run();
