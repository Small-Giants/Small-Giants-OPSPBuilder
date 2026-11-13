/**
 * Shows what the ClickUp sync would read from a task's agent recap, without
 * deploying anything or touching Firestore. Use it while writing the agent's
 * instructions to check its comments parse the way the sync expects.
 *
 *   $env:CLICKUP_API_TOKEN = "pk_..."
 *   npm run preview:recap -- <task id or URL> [--author "Recap Agent"]
 */
import { createRequire } from "node:module";
import type * as ClientModule from "../functions/src/clickup/client";
import type * as RecapModule from "../functions/src/clickup/recap";

// The functions package is CommonJS, which ESM named imports cannot reach.
const require = createRequire(import.meta.url);
const { ClickUpClient } = require("../functions/src/clickup/client") as typeof ClientModule;
const { DEFAULT_RECAP_MARKERS, commentText, findRecaps, parseRecap } =
  require("../functions/src/clickup/recap") as typeof RecapModule;

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const input = process.argv[2];
  const token = process.env.CLICKUP_API_TOKEN;
  if (!input || input.startsWith("--") || !token) {
    console.error(
      "Usage: CLICKUP_API_TOKEN=pk_... npm run preview:recap -- <task id or URL> [--author text]"
    );
    process.exit(1);
  }

  const taskId = input.includes("/")
    ? new URL(input).pathname.split("/").filter(Boolean).pop()!
    : input;
  const config = { recapMarkers: DEFAULT_RECAP_MARKERS, recapAuthor: flag("author") ?? "" };

  const client = new ClickUpClient({ token });
  const comments = await client.getTaskComments(taskId);
  console.log(`Read ${comments.length} comment(s) on task ${taskId}.`);
  comments.slice(0, 5).forEach((c) => {
    const firstLine = commentText(c).split(/\r?\n/).find((l) => l.trim()) ?? "";
    console.log(`  - ${c.user?.username ?? "(no author)"}: ${firstLine.slice(0, 80)}`);
  });

  const recaps = findRecaps(comments, config);
  if (recaps.length === 0) {
    console.log(
      `\nNo comment starts with ${config.recapMarkers.map((m) => `"${m}"`).join(" or ")}. The sync would change nothing.`
    );
    return;
  }

  for (const recap of recaps) {
    const parsed = parseRecap(commentText(recap));
    const replies = await client.getCommentReplies(recap.id);
    console.log(`\nComment ${recap.id} by ${recap.user?.username ?? "(no author)"}:`);
    console.log(
      JSON.stringify(
        {
          period: parsed.period,
          status: parsed.status,
          summary: parsed.summary,
          completedQuarters: parsed.completedQuarters,
          actuals: parsed.actuals,
          rocks: parsed.rocks,
          replies: replies.map((r) => `${r.user?.username ?? "?"}: ${commentText(r).slice(0, 60)}`),
          warnings: parsed.warnings,
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
