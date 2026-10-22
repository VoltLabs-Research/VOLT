![Introducing VOLT](https://github.com/VoltLabs-Research/docs.voltcloud.dev/blob/main/public/assets/getting-started/introducing-volt.png?raw=true)

## Self-hosting

Run the full VOLT stack on your own machine. Requires `docker`, `node`, and `curl`.

**Deploy** (interactive — prompts for host, account, team, and cluster):

```bash
curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/packages/apps/desktop/scripts/deploy.sh | bash
```

**Update** an existing deployment to the latest release (keeps your data):

```bash
curl -fsSL https://raw.githubusercontent.com/voltlabs-research/volt/main/packages/apps/desktop/scripts/deploy.sh | bash -s -- --update
```

### Desktop app

Prefer a one-click setup? Download the desktop app. It runs the whole stack in its window, the same WebAssembly build the browser runs, with no Docker, database or other dependencies to install, and keeps your workspace on your computer:

- [Download the latest release](https://github.com/VoltLabs-Research/VOLT/releases/latest)

For full documentation, visit [docs.voltcloud.dev](https://docs.voltcloud.dev).