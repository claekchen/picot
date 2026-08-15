// ABOUTME: First Lit + TypeScript component in the native frontend. Renders
// ABOUTME: the header connection/run status pill's two spans (dot + text)
// ABOUTME: via Lit, in light DOM, so existing header.css class selectors and
// ABOUTME: `session-status.js`'s imperative updates keep working unchanged.

import { html, LitElement } from "lit";

/**
 * State ownership and imperative updates stay in `session-status.js`, which
 * queries `#status-indicator`/`#status-text` exactly as it did before this
 * element existed — those ids are real light-DOM nodes, not shadow-scoped.
 * This component only owns the initial template.
 */
export class SessionStatusPill extends LitElement {
  protected createRenderRoot(): this {
    return this;
  }

  protected render() {
    return html`
      <span class="status-indicator" id="status-indicator"></span>
      <span class="status-text" id="status-text">Connecting...</span>
    `;
  }
}

customElements.define("picot-session-status", SessionStatusPill);
