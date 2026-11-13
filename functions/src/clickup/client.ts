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
  assignees?: ClickUpUser[];
}

export interface ClickUpComment {
  id: string;
  comment_text?: string;
  comment?: { text?: string }[];
  /** Agent and integration authors can arrive with no id, only a name. */
  user?: ClickUpUser | null;
  /** Epoch milliseconds, as a string. */
  date?: string;
  /** Number of threaded replies, as a string or number depending on endpoint. */
  reply_count?: string | number;
}

export interface ClickUpUser {
  id?: number;
  username?: string;
  email?: string;
  initials?: string;
  /** Workspace role: 1 owner, 2 admin, 3 member, 4 guest. */
  role?: number;
}

export interface ClickUpWorkspace {
  id: string;
  name?: string;
  members?: { user: ClickUpUser }[];
}

export interface NewClickUpTask {
  name: string;
  markdown_description?: string;
  assignees?: number[];
  due_date?: number | null;
  start_date?: number | null;
}

/** People-type custom field writes take a diff rather than the full list. */
export interface PeopleFieldValue {
  add: number[];
  rem: number[];
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

  /**
   * Newest first, 25 per page. Pages back until `stop` matches or `maxPages`
   * runs out, so a busy task does not cost a call per comment ever written.
   */
  async getTaskComments(
    taskId: string,
    { maxPages = 4, stop }: { maxPages?: number; stop?: (page: ClickUpComment[]) => boolean } = {}
  ): Promise<ClickUpComment[]> {
    const all: ClickUpComment[] = [];
    let cursor: ClickUpComment | undefined;

    for (let page = 0; page < maxPages; page += 1) {
      const params = cursor
        ? `?start=${encodeURIComponent(cursor.date ?? "")}&start_id=${encodeURIComponent(cursor.id)}`
        : "";
      const body = await this.request<{ comments?: ClickUpComment[] }>(
        `/task/${encodeURIComponent(taskId)}/comment${params}`
      );
      const comments = body.comments ?? [];
      all.push(...comments);

      if (comments.length < 25 || stop?.(comments)) break;
      cursor = comments[comments.length - 1];
    }

    return all;
  }

  async getCommentReplies(commentId: string): Promise<ClickUpComment[]> {
    const body = await this.request<{ comments?: ClickUpComment[] }>(
      `/comment/${encodeURIComponent(commentId)}/reply`
    );
    return body.comments ?? [];
  }

  /** Every workspace the token can see, with its members. */
  async getWorkspaces(): Promise<ClickUpWorkspace[]> {
    const body = await this.request<{ teams?: ClickUpWorkspace[] }>("/team");
    return body.teams ?? [];
  }

  async getSpaceLists(spaceId: string): Promise<{ id: string; name?: string }[]> {
    const body = await this.request<{ lists?: { id: string; name?: string }[] }>(
      `/space/${encodeURIComponent(spaceId)}/list?archived=false`
    );
    return body.lists ?? [];
  }

  async getListFields(listId: string): Promise<ClickUpCustomField[]> {
    const body = await this.request<{ fields?: ClickUpCustomField[] }>(
      `/list/${encodeURIComponent(listId)}/field`
    );
    return body.fields ?? [];
  }

  async createTask(listId: string, task: NewClickUpTask): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/list/${encodeURIComponent(listId)}/task`, {
      method: "POST",
      body: task,
    });
  }

  async updateTask(
    taskId: string,
    changes: Omit<Partial<NewClickUpTask>, "assignees"> & { assignees?: PeopleFieldValue }
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${encodeURIComponent(taskId)}`, {
      method: "PUT",
      body: changes,
    });
  }

  async setPeopleField(taskId: string, fieldId: string, value: PeopleFieldValue): Promise<void> {
    await this.request(
      `/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(fieldId)}`,
      { method: "POST", body: { value } }
    );
  }

  /** Cheap call used to validate a token before saving the integration. */
  async getAuthorizedUser(): Promise<{ user: { id: number; username?: string; email?: string } }> {
    return this.request("/user");
  }

  private async request<T>(
    path: string,
    { method = "GET", body }: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.doFetch(`${API_BASE}${path}`, {
        method,
        headers: { Authorization: this.token, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
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
      return "That ClickUp task, list, or space does not exist, or the token cannot see it.";
    case 429:
      return "ClickUp rate limit hit. The next sync will pick up where this one stopped.";
    default:
      return `ClickUp returned ${status}. ${trimmed}`;
  }
}
