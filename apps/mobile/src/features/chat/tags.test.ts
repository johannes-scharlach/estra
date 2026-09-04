import { describe, expect, it } from "vitest";

import { parseSegments } from "./tags";

describe("parseSegments", () => {
  it("parses a complete ideas block into titled ideas with trimmed bodies", () => {
    expect(
      parseSegments(
        '<ideas><idea title="Pasta">  One \n</idea>\n<idea title="Soup">Two</idea></ideas>',
      ),
    ).toEqual([
      {
        type: "ideas",
        ideas: [
          { title: "Pasta", body: "One" },
          { title: "Soup", body: "Two" },
        ],
      },
    ]);
  });

  it("parses ideas from an unclosed block mid-stream", () => {
    expect(
      parseSegments('<ideas><idea title="Pasta">One</idea><idea title="Soup">Two'),
    ).toEqual([
      {
        type: "ideas",
        ideas: [
          { title: "Pasta", body: "One" },
          { title: "Soup", body: "Two" },
        ],
      },
    ]);
  });

  it("renders a just-opened idea as a card once its title arrived", () => {
    expect(parseSegments('<ideas><idea title="Soup">')).toEqual([
      { type: "ideas", ideas: [{ title: "Soup", body: "" }] },
    ]);
  });

  it("renders a truncated tag as a placeholder card for the renderer's …", () => {
    expect(parseSegments("<ideas><idea ")).toEqual([
      { type: "ideas", ideas: [{ title: "", body: "" }] },
    ]);
  });

  it("strips stray and broken tags from markdown, never raw angle brackets", () => {
    expect(parseSegments("So <idea>weird</sketch> text <ideas")).toEqual([
      { type: "markdown", text: "So weird text" },
    ]);
  });

  it("parses a sketch with its title attribute", () => {
    expect(parseSegments('<sketch title="Fried rice">Do this.</sketch>')).toEqual([
      { type: "sketch", title: "Fried rice", body: "Do this." },
    ]);
  });

  it("keeps text before, between, and after blocks, in order", () => {
    expect(
      parseSegments(
        'Start. <ideas><idea title="A">a</idea></ideas> Middle. <sketch title="B">b</sketch> End.',
      ),
    ).toEqual([
      { type: "markdown", text: "Start." },
      { type: "ideas", ideas: [{ title: "A", body: "a" }] },
      { type: "markdown", text: "Middle." },
      { type: "sketch", title: "B", body: "b" },
      { type: "markdown", text: "End." },
    ]);
  });

  it("drops an empty ideas block", () => {
    expect(parseSegments("<ideas></ideas>")).toEqual([]);
  });
});
