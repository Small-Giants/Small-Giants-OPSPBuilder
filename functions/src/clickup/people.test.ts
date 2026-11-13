import { describe, expect, it } from "vitest";
import { buildDirectory, clickUpIdFor, findPerson, memberIdFromPersonId } from "./people";
import type { UserRecord } from "../types";

const users: UserRecord[] = [
  { id: "uid-pat", name: "Patrick Kuhl", email: "patrick@smallgiantsonline.com" },
  { id: "uid-old", name: "Patrick Kuhl", email: "patrick@smallgiantsonline.com", deletedAt: "2025-01-01" },
  { id: "uid-thomas", name: "Thomas Rider", email: "ThomasR@smallgiantsonline.com" },
];

const members = [
  { id: 11, username: "Patrick Kuhl", email: "patrick@smallgiantsonline.com" },
  { id: 22, username: "Thomas Rider", email: "thomasr@smallgiantsonline.com" },
  { id: 33, username: "James Richardson", email: "james@smallgiantsonline.com" },
];

const directory = buildDirectory(users, members);

describe("buildDirectory", () => {
  it("joins app accounts to ClickUp members by email, ignoring case and deleted accounts", () => {
    expect(directory.find((p) => p.id === "uid-thomas")?.clickupUserId).toBe(22);
    expect(directory.filter((p) => p.name === "Patrick Kuhl")).toHaveLength(1);
  });

  it("adds ClickUp-only members under a clickup: id", () => {
    expect(directory.find((p) => p.name === "James Richardson")).toMatchObject({
      id: "clickup:33",
      clickupUserId: 33,
    });
  });
});

describe("findPerson", () => {
  it("matches by email, full name, or a unique first name", () => {
    expect(findPerson(directory, "JAMES@smallgiantsonline.com")?.id).toBe("clickup:33");
    expect(findPerson(directory, "thomas  rider")?.id).toBe("uid-thomas");
    expect(findPerson(directory, "Thomas")?.id).toBe("uid-thomas");
    expect(findPerson(directory, "@Patrick Kuhl")?.id).toBe("uid-pat");
  });

  it("refuses to guess between two people with the same first name", () => {
    const crowded = buildDirectory(users, [...members, { id: 44, username: "Thomas Hale" }]);
    expect(findPerson(crowded, "Thomas")).toBeNull();
  });

  it("returns null for someone nobody knows", () => {
    expect(findPerson(directory, "Nobody Here")).toBeNull();
  });
});

describe("clickUpIdFor", () => {
  it("resolves app accounts and clickup: ids", () => {
    expect(clickUpIdFor(directory, "uid-pat")).toBe(11);
    expect(clickUpIdFor(directory, "clickup:99")).toBe(99);
    expect(clickUpIdFor(directory, "James Richardson")).toBeNull();
    expect(memberIdFromPersonId("uid-pat")).toBeNull();
  });
});
