import { app, page, route } from "@wasp.sh/spec";

import { App } from "./src/app" with { type: "ref" };
import { ambientWorkspaceSpec } from "./src/ambient-workspace/ambient-workspace.wasp";
import { authConfig } from "./src/auth/auth.wasp";
import { head } from "./src/head.wasp";

export default app({
  name: "codeshotDev",
  title: "codeshot.dev | Beautiful code screenshots",
  wasp: { version: "^0.24.0" },
  auth: authConfig,
  head,
  spec: [
    route("RootRoute", "/", page(App), { prerender: true, lazy: false }),
    ambientWorkspaceSpec,
  ],
});
