export interface ClickUpLocation {
  /** The workspace id, the first path segment of every ClickUp app URL. */
  workspaceId: string | null;
  listId: string | null;
  spaceId: string | null;
}

/**
 * Reads a pasted ClickUp list or space URL. ClickUp links come in several
 * shapes depending on where they were copied from:
 *
 *   https://app.clickup.com/9011/v/li/901105786543         list
 *   https://app.clickup.com/9011/v/l/6-901105786543-1      list view
 *   https://app.clickup.com/9011/v/s/90110123456           space
 *   https://app.clickup.com/9011/v/o/s/90110123456         space overview
 *
 * Workspaces on a custom subdomain (smallgiants.clickup.com) use the same paths.
 */
export function parseClickUpLocation(input: string): ClickUpLocation | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!url.hostname.endsWith("clickup.com")) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const workspaceId = /^\d+$/.test(segments[0] ?? "") ? segments[0] : null;
  const after = (marker: string) => {
    const index = segments.indexOf(marker);
    return index === -1 ? undefined : segments[index + 1];
  };

  const listLocation = after("li");
  if (listLocation) return { workspaceId, listId: listLocation, spaceId: null };

  const listView = after("l")?.match(/^\d+-(\d+)-\d+$/);
  if (listView) return { workspaceId, listId: listView[1], spaceId: null };

  const space = after("s");
  if (space) return { workspaceId, listId: null, spaceId: space };

  return null;
}
