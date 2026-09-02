import { showNativeDialog } from "../extensions/dialog.js";
import { createAcpState, reduceAcpEvent, resolvePermissionRequest } from "./acp-store.js";

/**
 * Renders the independent turn list for a session whose backend is an
 * external ACP agent, and mediates `session/request_permission` prompts
 * through the same modal chrome the extension-UI host uses (`dialog.js`),
 * just triggered by `acp_permission_request` events instead of
 * `extension_ui_request`.
 */
export function setupAcpPanel({ container, messagesElement, onRespondPermission }) {
  let state = createAcpState();
  const dialogsInFlight = new Set();

  function show() {
    container.classList.remove("hidden");
    messagesElement?.classList.add("hidden");
  }

  function hide() {
    container.classList.add("hidden");
    messagesElement?.classList.remove("hidden");
  }

  function render() {
    container.innerHTML = "";
    for (const block of state.blocks) {
      const element = renderBlock(block);
      if (element) container.appendChild(element);
    }
    if (state.error) {
      const errorEl = document.createElement("div");
      errorEl.className = "acp-block acp-error";
      errorEl.textContent = state.error;
      container.appendChild(errorEl);
    }
    container.scrollTop = container.scrollHeight;
    presentPendingPermissions();
  }

  function presentPendingPermissions() {
    for (const request of state.permissionRequests) {
      if (dialogsInFlight.has(request.requestId)) continue;
      dialogsInFlight.add(request.requestId);
      presentPermission(request);
    }
  }

  async function presentPermission(request) {
    const options = request.params?.options ?? [];
    const toolCall = request.params?.toolCall ?? {};
    const labels = options.map(
      (option, index) => `${index + 1}. ${option.name ?? option.optionId ?? "Option"}`,
    );
    const result = await showNativeDialog({
      method: "select",
      title: toolCall.title || "Permission requested",
      options: labels,
    });
    let optionId;
    if (result?.value) {
      const index = labels.indexOf(result.value);
      optionId = index >= 0 ? options[index]?.optionId : undefined;
    }
    dialogsInFlight.delete(request.requestId);
    state = resolvePermissionRequest(state, request.requestId);
    onRespondPermission(request.requestId, optionId);
  }

  function apply(event) {
    state = reduceAcpEvent(state, event);
    render();
  }

  function reset() {
    state = createAcpState();
    dialogsInFlight.clear();
    container.innerHTML = "";
  }

  return { show, hide, apply, reset };
}

function renderBlock(block) {
  if (block.kind === "message") {
    const el = document.createElement("div");
    el.className = "acp-block acp-message";
    el.textContent = block.text;
    return el;
  }
  if (block.kind === "thought") {
    const el = document.createElement("div");
    el.className = "acp-block acp-thought";
    el.textContent = block.text;
    return el;
  }
  if (block.kind === "tool_call") {
    const el = document.createElement("div");
    el.className = `acp-block acp-tool-call acp-tool-call-${block.status ?? "pending"}`;
    const title = document.createElement("div");
    title.className = "acp-tool-call-title";
    title.textContent = block.title || "Tool call";
    el.appendChild(title);
    if (block.content) {
      const body = document.createElement("pre");
      body.className = "acp-tool-call-content";
      body.textContent =
        typeof block.content === "string" ? block.content : JSON.stringify(block.content, null, 2);
      el.appendChild(body);
    }
    return el;
  }
  if (block.kind === "plan") {
    const el = document.createElement("div");
    el.className = "acp-block acp-plan";
    const list = document.createElement("ul");
    for (const entry of block.entries) {
      const item = document.createElement("li");
      item.textContent = entry.content ?? entry.title ?? JSON.stringify(entry);
      list.appendChild(item);
    }
    el.appendChild(list);
    return el;
  }
  return null;
}
