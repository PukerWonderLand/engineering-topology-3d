# Deployment

Engineering Topology 3D produces a static `dist/` directory. Node.js is required to validate and build the project, but it is not required by the deployed site.

## Build and select the default scene

Install the pinned dependencies and run the complete check before publishing:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm test
```

The ordinary build defaults to `t113-arm-xvc` at `/`. Any known scene can still be selected with `?scene=<scene-id>`.

Set `VITE_DEFAULT_SCENE` at build time when a deployment should open another SceneDefinition 2.0 scene at `/`. The query parameter remains the highest-priority override:

```bash
VITE_DEFAULT_SCENE=eg942h-g30-r2-m4 pnpm build
```

`VITE_DEFAULT_SCENE` is compiled into the static JavaScript bundle. Changing it requires a rebuild; it is not a server-side runtime setting. Vite rejects malformed or unknown configured scene IDs before producing a deployment, and the application keeps a separate recovery page for invalid URL query values.

## GitHub Pages

GitHub Pages is deployed by `.github/workflows/pages.yml`. The workflow builds from a clean checkout and uploads only `dist/`. Relative asset URLs allow project Pages at `/engineering-topology-3d/` without hard-coded repository paths.

The public Pages workflow intentionally keeps the repository default scene. A machine-specific default should be selected only in that deployment's build command, not committed as a private `.env` file.

## Linux systemd static service

The repository includes `deploy/systemd/engineering-topology-3d.service`. It serves a previously built site from `/var/www/engineering-topology-3d` with Python's standard-library static server. The unit listens on `127.0.0.1:4314` by default and runs as a transient unprivileged user.

On Ubuntu, build and install the static files:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm test
VITE_DEFAULT_SCENE=eg942h-g30-r2-m4 pnpm build

sudo install -d -o root -g root -m 0755 /var/www/engineering-topology-3d
sudo rsync -a --delete --chown=root:root dist/ /var/www/engineering-topology-3d/
sudo install -o root -g root -m 0644 \
  deploy/systemd/engineering-topology-3d.service \
  /etc/systemd/system/engineering-topology-3d.service
sudo systemctl daemon-reload
sudo systemctl enable --now engineering-topology-3d.service
```

Verify the service and the selected root scene:

```bash
systemctl status engineering-topology-3d.service --no-pager
curl --fail http://127.0.0.1:4314/
curl --fail 'http://127.0.0.1:4314/?scene=eg942h-g30-r2-m4'
```

The `rsync --delete` command removes stale hashed assets only inside the exact `/var/www/engineering-topology-3d/` target. Review that path before running it.

### Explicit LAN access

Loopback-only listening is the safe default. To expose the site to a trusted LAN, add a systemd drop-in:

```bash
sudo systemctl edit engineering-topology-3d.service
```

Enter:

```ini
[Service]
Environment=ET3D_BIND=0.0.0.0
```

Then reload and verify:

```bash
sudo systemctl daemon-reload
sudo systemctl restart engineering-topology-3d.service
ss -lntp 'sport = :4314'
```

Binding to `0.0.0.0` does not provide authentication or encryption. Restrict port `4314` with the host firewall and upstream ACLs, and do not publish scenes containing credentials, real infrastructure addresses, unique device identifiers, or operational logs.

### Stop, disable, and inspect logs

```bash
sudo systemctl stop engineering-topology-3d.service
sudo systemctl disable engineering-topology-3d.service
sudo journalctl -u engineering-topology-3d.service --no-pager
```

## Nginx and other static hosts

For Nginx or an object store, publish only `dist/` and use ordinary static caching. The application selects scenes through a query parameter, so no SPA history fallback is required.
