#![allow(dead_code)]

use std::path::PathBuf;

/// How to spawn one external Agent Client Protocol (ACP) coding agent — the
/// same shape `NativeLaunchSpec` plays for the embedded Pi runtime, but for a
/// subprocess that speaks ACP JSON-RPC over stdio instead of Pi's flat framing.
#[derive(Debug, Clone)]
pub struct AcpLaunchSpec {
    /// Stable id used in `RuntimeTarget`-adjacent bookkeeping and by the
    /// composer's `#` picker, e.g. `"claude-code"`.
    pub agent_id: String,
    /// Human-readable name shown in the composer picker.
    pub label: String,
    pub command: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
}

/// Resolve a built-in ACP agent preset. Only `"claude-code"` ships today; the
/// command is overridable via `PICOT_ACP_CLAUDE_CMD` (a whitespace-separated
/// command line) so a future npm package rename doesn't require a code change.
/// Codex/Cursor presets are follow-up config entries, not new code paths.
pub fn resolve_preset(agent_id: &str, cwd: PathBuf) -> Result<AcpLaunchSpec, String> {
    match agent_id {
        "claude-code" => {
            let raw = std::env::var("PICOT_ACP_CLAUDE_CMD")
                .unwrap_or_else(|_| "npx -y @agentclientprotocol/claude-agent-acp".to_string());
            let mut parts = raw.split_whitespace();
            let command = parts
                .next()
                .ok_or_else(|| "PICOT_ACP_CLAUDE_CMD is empty".to_string())?
                .to_string();
            let args = parts.map(str::to_string).collect();
            Ok(AcpLaunchSpec {
                agent_id: agent_id.to_string(),
                label: "Claude Code".to_string(),
                command,
                args,
                cwd,
            })
        }
        other => Err(format!("Unknown ACP agent preset: {other}")),
    }
}

/// The list surfaced to the composer's `#` picker.
pub fn available_presets() -> Vec<(&'static str, &'static str)> {
    vec![("claude-code", "Claude Code")]
}

#[cfg(test)]
mod tests {
    use super::resolve_preset;
    use std::path::PathBuf;

    #[test]
    fn claude_code_preset_defaults_to_the_verified_npx_command() {
        // SAFETY: test-only env mutation, single-threaded within this test.
        unsafe {
            std::env::remove_var("PICOT_ACP_CLAUDE_CMD");
        }
        let spec = resolve_preset("claude-code", PathBuf::from("/workspace")).unwrap();
        assert_eq!(spec.command, "npx");
        assert_eq!(
            spec.args,
            vec!["-y", "@agentclientprotocol/claude-agent-acp"]
        );
        assert_eq!(spec.cwd, PathBuf::from("/workspace"));
    }

    #[test]
    fn unknown_preset_is_rejected() {
        assert!(resolve_preset("codex", PathBuf::from("/workspace")).is_err());
    }
}
