# codeshot.dev CLI

Turn a local source file into a PNG:

```sh
npx codeshot.dev render src/app.tsx --theme macos --output screenshot.png
```

Use `-` for stdin and provide its language explicitly:

```sh
printf 'const answer = 42' | npx codeshot.dev render - --language typescript --output screenshot.png
```

Discover the current public contract:

```sh
npx codeshot.dev themes --json
npx codeshot.dev theme macos --json
npx codeshot.dev capabilities --json
```

Set `CODESHOT_API_URL` to override the default API at `https://api.codeshot.dev`.
