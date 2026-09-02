import { onLocaleChange, t } from "../i18n.js";

/**
 * <ssh-remote-settings-panel> Web Component
 *
 * The "SSH Remote" tab inside Settings. Lets a trusted project delegate its
 * read/write/edit/bash tool calls to a remote host over SSH (see
 * extensions/ssh-remote.ts). Config is stored per-project in
 * .pi/settings.json under the `sshRemote` key.
 */

class SshRemoteSettingsPanel extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.innerHTML = `
      <div class="settings-body">
        <div class="settings-section">
          <div class="settings-section-title" data-i18n="sshRemote.title">SSH Remote Execution</div>
          <p class="settings-help" data-i18n="sshRemote.description">
            Run this project's read, write, edit, and bash tool calls on a remote host over SSH instead of locally.
          </p>
          <div class="ssh-remote-notice hidden" data-untrusted-notice data-i18n="sshRemote.untrustedNotice">
            Trust this project to configure SSH remote execution.
          </div>
          <div class="settings-row" id="setting-ssh-remote-enabled">
            <span class="settings-label settings-label-stack">
              <span class="settings-label-main" data-i18n="sshRemote.enableLabel">Enable SSH remote execution</span>
              <span class="settings-label-sub" data-i18n="sshRemote.enableSub">Applies to this project only, starting with the next session</span>
            </span>
            <button type="button" class="settings-toggle" data-enabled-toggle role="switch" aria-checked="false"></button>
          </div>
          <div class="ssh-remote-form">
            <label class="ssh-remote-field">
              <span class="settings-label-sub" data-i18n="sshRemote.hostLabel">Host</span>
              <input class="ui-input" data-field="host" type="text" autocomplete="off" spellcheck="false"
                placeholder="192.168.1.50 or my-server.example.com" data-i18n-ph="sshRemote.hostPlaceholder" />
            </label>
            <label class="ssh-remote-field ssh-remote-field--sm">
              <span class="settings-label-sub" data-i18n="sshRemote.portLabel">Port</span>
              <input class="ui-input" data-field="port" type="number" min="1" max="65535" autocomplete="off"
                placeholder="22" data-i18n-ph="sshRemote.portPlaceholder" />
            </label>
            <label class="ssh-remote-field ssh-remote-field--sm">
              <span class="settings-label-sub" data-i18n="sshRemote.userLabel">Username</span>
              <input class="ui-input" data-field="user" type="text" autocomplete="off" spellcheck="false"
                placeholder="ubuntu" data-i18n-ph="sshRemote.userPlaceholder" />
            </label>
            <label class="ssh-remote-field">
              <span class="settings-label-sub" data-i18n="sshRemote.remotePathLabel">Remote path</span>
              <input class="ui-input" data-field="remotePath" type="text" autocomplete="off" spellcheck="false"
                placeholder="Detected automatically if left blank" data-i18n-ph="sshRemote.remotePathPlaceholder" />
            </label>
            <label class="ssh-remote-field">
              <span class="settings-label-sub" data-i18n="sshRemote.identityFileLabel">Identity file</span>
              <input class="ui-input" data-field="identityFile" type="text" autocomplete="off" spellcheck="false"
                placeholder="~/.ssh/id_ed25519" data-i18n-ph="sshRemote.identityFilePlaceholder" />
            </label>
          </div>
          <p class="settings-help" data-i18n="sshRemote.requirementsNote">
            Requires key-based SSH authentication (no password prompts) and bash on the remote host.
          </p>
          <div class="ssh-remote-actions">
            <button class="ui-button ui-button--primary" data-action="save" data-i18n="sshRemote.save">Save</button>
            <button class="ui-button ui-button--secondary" data-action="test" data-i18n="sshRemote.testConnection">Test Connection</button>
          </div>
          <div class="settings-save-status hidden" data-status aria-live="polite" role="status"></div>
        </div>
      </div>
    `;

    this._untrustedNoticeEl = this.querySelector("[data-untrusted-notice]");
    this._toggleEl = this.querySelector("[data-enabled-toggle]");
    this._statusEl = this.querySelector("[data-status]");
    this._fields = {
      host: this.querySelector('[data-field="host"]'),
      port: this.querySelector('[data-field="port"]'),
      user: this.querySelector('[data-field="user"]'),
      remotePath: this.querySelector('[data-field="remotePath"]'),
      identityFile: this.querySelector('[data-field="identityFile"]'),
    };

    this._toggleEl.addEventListener("click", () => {
      const next = !this._toggleEl.classList.contains("on");
      this._applyToggleState(next);
    });

    this.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "save") this._save();
      if (button.dataset.action === "test") this._test();
    });

    document.querySelectorAll(".settings-nav-item").forEach((button) => {
      if (button.dataset.settingsTab === "ssh-remote") {
        button.addEventListener("click", () => this._load());
      }
    });

    this._handleConfigGatewayReady = () => this._load();
    window.addEventListener("picot-config-gateway-ready", this._handleConfigGatewayReady);
    this._unsubscribeLocale = onLocaleChange(() => {
      if (this._lastTestResult) this._renderTestResult(this._lastTestResult);
    });
    this._load();
  }

  disconnectedCallback() {
    if (this._handleConfigGatewayReady) {
      window.removeEventListener("picot-config-gateway-ready", this._handleConfigGatewayReady);
    }
    this._unsubscribeLocale?.();
  }

  _applyToggleState(enabled) {
    this._toggleEl.classList.toggle("on", enabled);
    this._toggleEl.setAttribute("aria-checked", String(enabled));
  }

  _setFormDisabled(disabled) {
    this._toggleEl.disabled = disabled;
    for (const input of Object.values(this._fields)) input.disabled = disabled;
    this.querySelector('[data-action="save"]').disabled = disabled;
    this.querySelector('[data-action="test"]').disabled = disabled;
  }

  _fillForm(config) {
    this._applyToggleState(Boolean(config?.enabled));
    this._fields.host.value = config?.host || "";
    this._fields.port.value = config?.port ?? "";
    this._fields.user.value = config?.user || "";
    this._fields.remotePath.value = config?.remotePath || "";
    this._fields.identityFile.value = config?.identityFile || "";
  }

  _readForm() {
    const port = this._fields.port.value.trim();
    return {
      enabled: this._toggleEl.classList.contains("on"),
      host: this._fields.host.value.trim(),
      ...(port ? { port: Number(port) } : {}),
      user: this._fields.user.value.trim(),
      remotePath: this._fields.remotePath.value.trim(),
      identityFile: this._fields.identityFile.value.trim(),
    };
  }

  async _load() {
    this._clearStatus();
    try {
      const { config, trusted } = await callPicotConfig("get_ssh_remote_config");
      this._fillForm(config);
      this._untrustedNoticeEl.classList.toggle("hidden", Boolean(trusted));
      this._setFormDisabled(!trusted);
    } catch (e) {
      this._showError(messageFromError(e) || t("sshRemote.loadFailed"));
    }
  }

  async _save() {
    this._clearStatus();
    const config = this._readForm();
    if (config.enabled && !config.host) {
      this._showError(t("sshRemote.hostRequired"));
      return;
    }
    const saveButton = this.querySelector('[data-action="save"]');
    saveButton.disabled = true;
    try {
      await callPicotConfig("set_ssh_remote_config", { config });
      this._showSuccess(t("sshRemote.saved"));
    } catch (e) {
      this._showError(t("sshRemote.saveFailed", { message: messageFromError(e) }));
    } finally {
      saveButton.disabled = false;
    }
  }

  async _test() {
    this._clearStatus();
    const config = this._readForm();
    if (!config.host) {
      this._showError(t("sshRemote.hostRequired"));
      return;
    }
    const testButton = this.querySelector('[data-action="test"]');
    testButton.disabled = true;
    this._showInfo(t("sshRemote.testing"));
    try {
      const result = await callPicotConfig("test_ssh_remote_config", { config });
      this._lastTestResult = result;
      this._renderTestResult(result);
    } catch (e) {
      this._lastTestResult = { ok: false, message: messageFromError(e) };
      this._renderTestResult(this._lastTestResult);
    } finally {
      testButton.disabled = false;
    }
  }

  _renderTestResult(result) {
    if (result.ok) {
      this._showSuccess(t("sshRemote.testOk", { path: result.remotePath || "" }));
    } else {
      this._showError(t("sshRemote.testFailed", { message: result.message || "" }));
    }
  }

  _showError(message) {
    this._statusEl.textContent = message;
    this._statusEl.style.color = "";
    this._statusEl.classList.remove("hidden");
  }

  _showInfo(message) {
    this._statusEl.textContent = message;
    this._statusEl.style.color = "var(--text-secondary)";
    this._statusEl.classList.remove("hidden");
  }

  _showSuccess(message) {
    this._statusEl.textContent = message;
    this._statusEl.style.color = "var(--color-success, #4ade80)";
    this._statusEl.classList.remove("hidden");
  }

  _clearStatus() {
    this._statusEl.classList.add("hidden");
  }
}

async function callPicotConfig(op, params = {}) {
  if (typeof window.__picotConfigCall !== "function") {
    throw new Error("Configuration channel is unavailable");
  }
  const result = await window.__picotConfigCall(op, params);
  if (!result?.ok) throw new Error(result?.error || `${op} failed`);
  return result.data || {};
}

function messageFromError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

customElements.define("ssh-remote-settings-panel", SshRemoteSettingsPanel);
