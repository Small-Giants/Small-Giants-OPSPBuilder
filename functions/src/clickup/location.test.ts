import { describe, expect, it } from "vitest";
import { parseClickUpLocation } from "./location";

describe("parseClickUpLocation", () => {
  it("reads a list location link", () => {
    expect(parseClickUpLocation("https://app.clickup.com/9011/v/li/901105786543")).toEqual({
      workspaceId: "9011",
      listId: "901105786543",
      spaceId: null,
    });
  });

  it("reads the list id out of a list view link", () => {
    expect(
      parseClickUpLocation("https://app.clickup.com/9011/v/l/6-901105786543-1?pr=123")?.listId
    ).toBe("901105786543");
  });

  it("reads space and space overview links", () => {
    expect(parseClickUpLocation("https://app.clickup.com/9011/v/s/90110123456")?.spaceId).toBe(
      "90110123456"
    );
    expect(
      parseClickUpLocation("https://smallgiants.clickup.com/14150185/v/o/s/90110123456")
    ).toEqual({ workspaceId: "14150185", listId: null, spaceId: "90110123456" });
  });

  it("rejects task links, folders, and other sites", () => {
    expect(parseClickUpLocation("https://app.clickup.com/t/868h790bp")).toBeNull();
    expect(parseClickUpLocation("https://app.clickup.com/9011/v/f/123")).toBeNull();
    expect(parseClickUpLocation("https://example.com/9011/v/li/1")).toBeNull();
    expect(parseClickUpLocation("not a url")).toBeNull();
  });
});
