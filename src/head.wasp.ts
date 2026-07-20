import { type App } from "@wasp.sh/spec";

const description =
  "Create polished, shareable code screenshots with ambient themes, line highlights, freehand annotations, and one-click PNG export.";
const title = "codeshot.dev | Beautiful code screenshots";
const siteUrl = "https://codeshot.dev/";
const imageUrl = "https://codeshot.dev/og-image-v1.png";
const imageAlt =
  "TypeScript code framed in codeshot.dev's navy Technical plate ambient theme.";

export const head: App["head"] = [
  `<meta name="description" content="${description}" />`,
  '<meta name="theme-color" content="#111111" />',
  '<meta name="robots" content="index, follow, max-image-preview:large" />',
  `<link rel="canonical" href="${siteUrl}" />`,
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  '<meta property="og:type" content="website" />',
  '<meta property="og:site_name" content="codeshot.dev" />',
  '<meta property="og:locale" content="en_US" />',
  `<meta property="og:url" content="${siteUrl}" />`,
  `<meta property="og:title" content="${title}" />`,
  `<meta property="og:description" content="${description}" />`,
  `<meta property="og:image" content="${imageUrl}" />`,
  '<meta property="og:image:type" content="image/png" />',
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  `<meta property="og:image:alt" content="${imageAlt}" />`,
  '<meta name="twitter:card" content="summary_large_image" />',
  `<meta name="twitter:title" content="${title}" />`,
  `<meta name="twitter:description" content="${description}" />`,
  `<meta name="twitter:image" content="${imageUrl}" />`,
  `<meta name="twitter:image:alt" content="${imageAlt}" />`,
];
