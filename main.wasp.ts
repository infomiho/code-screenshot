import { app, page, route } from "@wasp.sh/spec";

import { App } from "./src/app" with { type: "ref" };
import { agentSpec } from "./src/ambient/management/agent/agent.wasp";
import { librarySpec } from "./src/ambient/management/library/library.wasp";
import { sharingSpec } from "./src/ambient/management/sharing/sharing.wasp";
import { workspaceSpec } from "./src/ambient/management/workspace/workspace.wasp";
import { authConfig } from "./src/account/account.wasp";
import { head } from "./src/head.wasp";

export default app({
  name: "codeshotDev",
  title: "codeshot.dev | Beautiful code screenshots",
  wasp: { version: "^0.24.0" },
  auth: authConfig,
  head,
  spec: [
    route("RootRoute", "/", page(App), { prerender: true, lazy: false }),
    librarySpec,
    workspaceSpec,
    sharingSpec,
    agentSpec,
  ],
});
