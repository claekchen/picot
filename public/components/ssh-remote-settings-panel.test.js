import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initI18n } from "../i18n.js";
import "./ssh-remote-settings-panel.js";

const enMessages = JSON.parse(readFileSync(join(process.cwd(), "public/locales/en.json"), "utf8"));

async function flushPromises(count = 8) {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

function mountPanel() {
  const nav = document.createElement("button");
  nav.className = "settings-nav-item";
  nav.dataset.settingsTab = "ssh-remote";
  document.body.append(nav);
  const panel = document.createElement("ssh-remote-settings-panel");
  document.body.append(panel);
  return panel;
}

describe("ssh-remote-settings-panel", () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/locales/")) return { ok: true, json: async () => enMessages };
      return { ok: false, status: 404, json: async () => ({}) };
    });
    await initI18n();
  });

  afterEach(() => {
    delete window.__picotConfigCall;
  });

  it("loads config on connect and disables the form for an untrusted project", async () => {
    window.__picotConfigCall = vi.fn(async (op) => {
      if (op === "get_ssh_remote_config") {
        return {
          ok: true,
          data: {
            config: { enabled: true, host: "example.com", port: 2222 },
            trusted: false,
          },
        };
      }
      throw new Error(`unexpected op ${op}`);
    });

    const panel = mountPanel();
    await flushPromises();

    expect(panel.querySelector('[data-field="host"]').value).toBe("example.com");
    expect(panel.querySelector('[data-field="port"]').value).toBe("2222");
    expect(panel.querySelector("[data-enabled-toggle]").classList.contains("on")).toBe(true);
    expect(panel.querySelector("[data-untrusted-notice]").classList.contains("hidden")).toBe(false);
    expect(panel.querySelector('[data-field="host"]').disabled).toBe(true);
    expect(panel.querySelector('[data-action="save"]').disabled).toBe(true);
  });

  it("enables the form and hides the notice for a trusted project", async () => {
    window.__picotConfigCall = vi.fn(async (op) => {
      if (op === "get_ssh_remote_config") {
        return { ok: true, data: { config: { enabled: false, host: "" }, trusted: true } };
      }
      throw new Error(`unexpected op ${op}`);
    });

    const panel = mountPanel();
    await flushPromises();

    expect(panel.querySelector("[data-untrusted-notice]").classList.contains("hidden")).toBe(true);
    expect(panel.querySelector('[data-field="host"]').disabled).toBe(false);
  });

  it("blocks save and shows an error when enabling without a host", async () => {
    window.__picotConfigCall = vi.fn(async (op) => {
      if (op === "get_ssh_remote_config") {
        return { ok: true, data: { config: { enabled: false, host: "" }, trusted: true } };
      }
      throw new Error(`unexpected op ${op}`);
    });
    const panel = mountPanel();
    await flushPromises();

    panel.querySelector("[data-enabled-toggle]").click();
    panel.querySelector('[data-action="save"]').click();
    await flushPromises();

    expect(panel.querySelector("[data-status]").textContent).toBe("Host is required.");
    expect(window.__picotConfigCall).not.toHaveBeenCalledWith(
      "set_ssh_remote_config",
      expect.anything(),
    );
  });

  it("saves the form and reports success", async () => {
    const calls = [];
    window.__picotConfigCall = vi.fn(async (op, params) => {
      calls.push([op, params]);
      if (op === "get_ssh_remote_config") {
        return { ok: true, data: { config: { enabled: false, host: "" }, trusted: true } };
      }
      if (op === "set_ssh_remote_config") {
        return { ok: true, data: { config: params.config } };
      }
      throw new Error(`unexpected op ${op}`);
    });
    const panel = mountPanel();
    await flushPromises();

    panel.querySelector("[data-enabled-toggle]").click();
    panel.querySelector('[data-field="host"]').value = "example.com";
    panel.querySelector('[data-action="save"]').click();
    await flushPromises();

    expect(calls).toContainEqual([
      "set_ssh_remote_config",
      {
        config: { enabled: true, host: "example.com", user: "", remotePath: "", identityFile: "" },
      },
    ]);
    expect(panel.querySelector("[data-status]").textContent).toBe("Saved.");
  });

  it("runs a connection test and renders the result", async () => {
    window.__picotConfigCall = vi.fn(async (op) => {
      if (op === "get_ssh_remote_config") {
        return {
          ok: true,
          data: { config: { enabled: true, host: "example.com" }, trusted: true },
        };
      }
      if (op === "test_ssh_remote_config") {
        return { ok: true, data: { ok: true, message: "Connected", remotePath: "/srv/app" } };
      }
      throw new Error(`unexpected op ${op}`);
    });
    const panel = mountPanel();
    await flushPromises();

    panel.querySelector('[data-action="test"]').click();
    await flushPromises();

    expect(panel.querySelector("[data-status]").textContent).toBe(
      "Connected — remote path: /srv/app",
    );
  });

  it("renders a failed connection test", async () => {
    window.__picotConfigCall = vi.fn(async (op) => {
      if (op === "get_ssh_remote_config") {
        return {
          ok: true,
          data: { config: { enabled: true, host: "example.com" }, trusted: true },
        };
      }
      if (op === "test_ssh_remote_config") {
        return { ok: true, data: { ok: false, message: "Connection refused" } };
      }
      throw new Error(`unexpected op ${op}`);
    });
    const panel = mountPanel();
    await flushPromises();

    panel.querySelector('[data-action="test"]').click();
    await flushPromises();

    expect(panel.querySelector("[data-status]").textContent).toBe(
      "Connection failed: Connection refused",
    );
  });
});
