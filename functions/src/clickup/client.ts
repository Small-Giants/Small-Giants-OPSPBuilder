const API_BASE = "https://api.clickup.com/api/v2";

export interface ClickUpStatus {
  status: string;
  /** ClickUp marks the terminal column with type "closed" or "done". */
  type?: string;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: {
    options?: { id: string; name?: string; label?: string; orderindex?: number }[];
  };
}

export interface ClickUpTask {
  id: string;
  name: string;
  url?: string;
  status?: ClickUpStatus;
  due_date?: string | null;
  date_closed?: string | null;
  custom_fields?: ClickUpCustomField[];
  subtasks?: ClickUpTask[];
  list?: { id: string; name?: string };
}

export class ClickUpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "ClickUpError";
  }
}

export interface ClickUpClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
}

export class ClickUpClient {
  private readonly token: string;
  private readonly doFetch: typeof fetch;

  constructor({ token, fetchImpl }: ClickUpClientOptions) {
    if (!token) throw new Error("ClickUp token is missing.");
    this.token = token;
    this.doFetch = fetchImpl ?? fetch;
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(
      `/task/${encodeURIComponent(taskId)}?include_subtasks=true`
    );
  }

  async getListTasks(listId: string): Promise<ClickUpTask[]> {
    const body = await this.request<{ tasks: ClickUpTask[] }>(
      `/list/${encodeURIComponent(listId)}/task?subtasks=true&include_closed=true`
    );
    return body.tasks ?? [];
  }

  /** Cheap call used to validate a token before saving the integration. */
  async getAuthorizedUser(): Promise<{ user: { id: number; username?: string; email?: string } }> {
    return this.request("/user");
  }

  private async request<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.doFetch(`${API_BASE}${path}`, {
        headers: { Authorization: this.token, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      // Network-level failures are worth another attempt on the next sync.
      throw new ClickUpError(`Could not reach ClickUp: ${error?.message ?? error}`, 0, true);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ClickUpError(
        describeFailure(response.status, detail),
        response.status,
        response.status === 429 || response.status >= 500
      );
    }

    return (await response.json()) as T;
  }
}

function describeFailure(status: number, detail: string): string {
  const trimmed = detail.slice(0, 300);
  switch (status) {
    case 401:
    case 403:
      return "ClickUp rejected the API token. Re-run `firebase functions:secrets:set CLICKUP_API_TOKEN`.";
    case 404:
      return "That ClickUp task or list no longer exists.";
    case 429:
      return "ClickUp rate limit hit. The next sync will pick up where this one stopped.";
    default:
      return `ClickUp returned ${status}. ${trimmed}`;
  }
}
