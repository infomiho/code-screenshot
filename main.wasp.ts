import { action, api, app, page, query, route } from "@wasp.sh/spec";
import { App } from "./src/app" with { type: "ref" };
import { userSignupFields } from "./src/auth/github" with { type: "ref" };
import {
  createAmbient,
  createAmbientAgentSession,
  getAmbientDraft,
  getAmbientDraftRevision,
  getAmbientWorkspace,
  publishAmbient,
} from "./src/ambient-workspace/ambient-operations" with { type: "ref" };
import {
  getAgentDraft,
  getAgentPreview,
  getAgentSession,
  agentApiMiddleware,
  replaceAgentDraft,
} from "./src/ambient-workspace/agent-api" with { type: "ref" };

const description =
  "Create polished, shareable code screenshots with ambient themes, line highlights, freehand annotations, and one-click PNG export.";
const title = "codeshot.dev | Beautiful code screenshots";
const siteUrl = "https://code-screenshot.static.miho.dev/";
const imageUrl = "https://code-screenshot.static.miho.dev/og-image-v1.png";
const imageAlt =
  "TypeScript code framed in codeshot.dev's navy Technical plate ambient theme.";

export default app({
  name: "codeshotDev",
  title,
  wasp: { version: "^0.24.0" },
  auth: {
    userEntity: "User",
    methods: {
      gitHub: { userSignupFields },
    },
    onAuthFailedRedirectTo: "/",
  },
  head: [
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
  ],
  spec: [
    route("RootRoute", "/", page(App), { prerender: true, lazy: false }),
    query(getAmbientWorkspace, {
      entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
    }),
    query(getAmbientDraftRevision, { entities: ["Ambient", "AmbientDraft"] }),
    query(getAmbientDraft, { entities: ["Ambient", "AmbientDraft"] }),
    action(createAmbient, { entities: ["Ambient", "AmbientDraft", "AmbientAgentSession"] }),
    action(createAmbientAgentSession, { entities: ["Ambient", "AmbientAgentSession"] }),
    action(publishAmbient, { entities: ["Ambient", "AmbientDraft", "AmbientVersion"] }),
    api("GET", "/agent/sessions/:capability", getAgentSession, {
      auth: false,
      middlewareConfigFn: agentApiMiddleware,
    }),
    api("GET", "/agent/sessions/:capability/draft", getAgentDraft, {
      auth: false,
      middlewareConfigFn: agentApiMiddleware,
    }),
    api("PUT", "/agent/sessions/:capability/draft", replaceAgentDraft, {
      auth: false,
      middlewareConfigFn: agentApiMiddleware,
    }),
    api("GET", "/agent/sessions/:capability/preview", getAgentPreview, {
      auth: false,
      middlewareConfigFn: agentApiMiddleware,
    }),
  ],
});
