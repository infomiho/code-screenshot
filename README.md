# codeshot.dev

![The codeshot.dev editor](docs/screenshot.png)

Minimal code screenshot generator.

```bash
npm install --global @wasp.sh/wasp-cli@0.25.0
cd app
wasp install
cd ..
npm run dev
npm run build
npm run preview
```

## Deployment

Provision the Railway project once:

```bash
cd app
wasp deploy railway launch code-screenshot
```

After launch, push `main` to deploy updates through `.github/workflows/deploy.yml`. Do not deploy updates locally.

GitHub Actions requires `RAILWAY_API_TOKEN` and `RAILWAY_PROJECT_ID` repository secrets.

## Anonymous themes

Visitors create and edit a theme without an account; signing in is required only to save. Unclaimed
themes are swept hourly by the `collectAbandonedGuestWork` job.

The server rate limits only the writes an anonymous browser can reach. The coarse per-IP limit is a
Cloudflare rate limiting rule on `POST /operations/*` (one rule is included on the free plan).

## Analytics

Plausible requires the variables in `app/.env.server.example` and custom event goals matching these names exactly:

```text
Screenshot Copied
Screenshot Downloaded
Ambient Created
Ambient Version Saved
Ambient Sharing Enabled
Share Link Copied
Shared Ambient Viewed
Agent Prompt Copied
```
