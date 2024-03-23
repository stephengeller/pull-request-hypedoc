import JiraClient from "jira-client";

type JiraIssue = {
  key: string;
  summary: string;
  description: string;
}

/**
 * Converts the Jira API response to a JiraIssue object.
 */
function toJiraIssue(issueResponse: any): JiraIssue {
  return {
    key: issueResponse.key,
    summary: issueResponse.fields.summary,
    description: issueResponse.fields.description,
  };
}

type JiraApiOptions = {
  protocol: string;
  host: string;
  strictSSL: boolean;
}
const DEFAULT_OPTIONS: JiraApiOptions = {
  protocol: "https",
  host: "block.atlassian.net",
  strictSSL: true,
}

/**
 * A wrapper class around the Jira Client that provides a more user-friendly interface.
 */
export default class JiraApi {
  private jiraClient: JiraClient
  private username: string;
  
  constructor(username: string, apiKey: string, options: Partial<JiraApiOptions> = {}) {
    this.username = username;
    this.jiraClient = new JiraClient({
      ...DEFAULT_OPTIONS,
      ...options,
      username,
      password: apiKey,
      apiVersion: "2",
    });
  }

  /**
   * Fetures all the issues assigned to the user.
   * 
   * @param {boolean} [open=true] Whether to fetch only open issues.
   * @returns A list of issues assigned to the user.
   */
  getUserIssues(open: boolean = true): Promise<JiraIssue[]> {
    return this.jiraClient.getUsersIssues(this.username, open)
      .then(issues => issues.map(toJiraIssue));
  }

  /**
   * Fetches the issue details for the given ticket number.
   * 
   * @param ticketNumber The ticket number to fetch.
   * @returns The issue details or undefined if the issue is not found.
   */
  async getIssue(ticketNumber: string): Promise<JiraIssue | undefined> {
    const issue = await this.jiraClient.findIssue(ticketNumber);

    return issue ? toJiraIssue(issue) : undefined;
  }
}