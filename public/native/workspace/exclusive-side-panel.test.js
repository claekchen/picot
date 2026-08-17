// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { toggleExclusiveSidePanel } from "./exclusive-side-panel.js";

describe("toggleExclusiveSidePanel", () => {
  it("opens one side panel while closing the other", () => {
    const files = document.createElement("div");
    const diff = document.createElement("div");
    files.className = "collapsed";

    expect(toggleExclusiveSidePanel(files, [diff])).toBe(true);
    expect(files.classList.contains("collapsed")).toBe(false);
    expect(diff.classList.contains("collapsed")).toBe(true);

    expect(toggleExclusiveSidePanel(diff, [files])).toBe(true);
    expect(diff.classList.contains("collapsed")).toBe(false);
    expect(files.classList.contains("collapsed")).toBe(true);
  });

  it("closes the active panel when toggled again", () => {
    const panel = document.createElement("div");
    expect(toggleExclusiveSidePanel(panel)).toBe(false);
    expect(panel.classList.contains("collapsed")).toBe(true);
  });
});
