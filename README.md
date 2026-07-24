# codeshot.dev

![The codeshot.dev editor](docs/screenshot.png)

Minimal code screenshot generator.

```bash
npm install --global @wasp.sh/wasp-cli@0.24.0
wasp install
npm run dev
npm run build
npm run preview
```

## Deployment

Provision the Railway project once:

```bash
wasp deploy railway launch code-screenshot
```

After launch, push `main` to deploy updates through `.github/workflows/deploy.yml`. Do not deploy updates locally.

GitHub Actions requires `RAILWAY_API_TOKEN` and `RAILWAY_PROJECT_ID` repository secrets.

## Analytics

Plausible requires the variables in `.env.server.example` and custom event goals matching these names exactly:

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
