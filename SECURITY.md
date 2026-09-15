# Security and privacy

## Supported boundary

This MVP is a local application for **one trusted local OS user**, not a hosted/multi-user control plane. Loopback binding does not protect against malware or an agent with unrestricted local filesystem/network access. Do not expose it to the public internet. A private reverse proxy must authenticate/restrict the operator and use HTTPS; setup is external to this project.

The service enforces exact Host and Origin, rejects cross-site Fetch Metadata, serves one origin, and uses no wildcard CORS. A random HttpOnly SameSite=Strict cookie plus a per-session, in-memory CSRF token protects writes. Bootstrap is same-origin-only. The local browser credential is never passed to tasks. These controls defend against other websites, not a fully compromised local host. Agents with the same OS user's network access can obtain a local session, which is outside the threat model; use OS isolation if agents are untrusted.

CSP permits one exact hash for the pinned React Aria touch-action style (no arbitrary inline styles). It restricts resources and connections to self, scripts to bundled code, frames to none, objects to none and forms to self. Referrer policy is no-referrer. React escapes all transcript text. There is no rendered untrusted HTML, arbitrary RPC proxy, filesystem/terminal browser, attachment execution, automatic remote resource fetch, telemetry, external font request or update check.

## Credentials

Gateway bootstrap secret is explicit server-side input; keys and issued tokens stay in memory. No configuration/credential/private transcript directories are auto-read. Only read scope is requested. No admin, runtime-approval, write, password fallback, pairing bypass or impersonated privileged client. Live sends are disabled regardless of the browser request. Logs contain only coarse local readiness/failure information; upstream error payloads and authentication diagnostics are omitted.

Do not paste credentials into content. A conservative detector refuses recognizable private keys, bearer strings, provider keys and secret assignments before SQLite persistence. It is defense in depth, not a complete data-loss-prevention system. App-owned authentication secrets are structurally excluded from content storage and exports; arbitrary secret-like human text cannot be perfectly classified.

## Local data

Database file mode is 0600; newly created data directories use 0700 and the process uses umask 077. Existing custom parent-directory permissions are not changed. SQLite is not automatically encrypted. Snapshots and review events retain potentially sensitive selected text; retain backups accordingly. The main database, transient journals, exports and backups may each contain copies. There is no claim of secure erase.

Demo and live use separate database files with enforced mode markers. Gateway references are namespaced by a hash of the explicit endpoint and the paired device identity (not an inferred human identity). Session key, session instance, message, task and run IDs are separate. Source pages are held in memory on demand; explicitly saved excerpts are durable. A source disappearing does not change saved speech. Original excerpt/hash remain distinct from an edited interpretation.

## Execution scope

claw-chat's checkpoint applies only to dispatch of its next managed stage. A task could cause effects before it returns; the checkpoint does not undo them or govern arbitrary native descendants. Runtime tool policies remain Gateway-owned. In this build only synthetic demo tasks can run. Unknown results never trigger blind re-dispatch, and a context update never patches an already-launched snapshot.

## Reporting

Do not post credentials, real transcripts, databases, screenshots or private logs in public issues. Report with a minimal synthetic reproduction. Use the repository's private security reporting feature when available; otherwise ask maintainers for a private channel without including the sensitive payload. This repository makes no promise of a staffed incident-response SLA.
