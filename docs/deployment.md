# Deployment

Build with `pnpm install --frozen-lockfile && pnpm build`. Publish the resulting `dist/` directory as immutable static files.

GitHub Pages is deployed by `.github/workflows/pages.yml`. The workflow builds from a clean checkout and uploads only `dist/`. Relative asset URLs allow project Pages at `/engineering-topology-3d/` without hard-coded repository paths.

For Nginx, copy `dist/` into the document root and use ordinary static caching. No Node.js process is needed after the build.
