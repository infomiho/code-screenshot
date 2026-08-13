# codeshot.dev CLI

Turn a local source file into a PNG:

```sh
npx codeshot.dev render src/app.tsx --theme macos --output screenshot.png
```

Use `-` for stdin and provide its language explicitly:

```sh
printf 'const answer = 42' | npx codeshot.dev render - --language typescript --output screenshot.png
```

## Choose a theme

Use an included theme by name:

```sh
npx codeshot.dev render src/app.tsx --theme technical-plate --output screenshot.png
```

For a theme you published with link sharing enabled, pass its share URL or `share:` reference:

```sh
npx codeshot.dev render src/app.tsx --theme https://codeshot.dev/a/SHARE_ID --output screenshot.png
npx codeshot.dev render src/app.tsx --theme share:SHARE_ID --output screenshot.png
```

Both forms use the theme's current published version. Pin a version when you need reproducible output:

```sh
npx codeshot.dev render src/app.tsx --theme share:SHARE_ID@2 --output screenshot.png
```

Resolve any theme input to the exact reference used for rendering:

```sh
npx codeshot.dev theme https://codeshot.dev/a/SHARE_ID
# share:SHARE_ID@2
```

Discover the current public contract:

```sh
npx codeshot.dev themes --json
npx codeshot.dev theme macos --json
npx codeshot.dev capabilities --json
```

Set `CODESHOT_API_URL` to override the default API at `https://api.codeshot.dev`.
