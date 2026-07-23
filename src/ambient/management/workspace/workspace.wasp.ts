import { action, api, apiNamespace, page, query, route, type Spec } from "@wasp.sh/spec";

import { AmbientWorkspacePage } from "./AmbientWorkspacePage" with { type: "ref" };
import {
  ambientWorkspaceApiMiddleware,
  streamAmbientChanges,
} from "../ambient-change-stream" with { type: "ref" };
import {
  createDraftFromVersion,
  discardAmbientDraft,
  getAmbientWorkspace,
  saveAmbientVersion,
  syncAmbientDraft,
} from "../ambient-operations" with { type: "ref" };

export const workspaceSpec: Spec = [
  route(
    "AmbientWorkspaceRoute",
    "/ambients/:ambientId",
    page(AmbientWorkspacePage, { authRequired: true }),
  ),
  query(getAmbientWorkspace, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  query(syncAmbientDraft, { entities: ["Ambient", "AmbientDraft"] }),
  action(discardAmbientDraft, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(createDraftFromVersion, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(saveAmbientVersion, { entities: ["Ambient", "AmbientDraft", "AmbientVersion"] }),
  api("GET", "/ambient-workspaces/:ambientId/events", streamAmbientChanges, {
    auth: true,
    entities: ["Ambient"],
  }),
  apiNamespace("/ambient-workspaces", {
    middlewareConfigFn: ambientWorkspaceApiMiddleware,
  }),
];
