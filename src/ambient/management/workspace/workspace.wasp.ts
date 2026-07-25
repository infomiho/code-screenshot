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
  renameAmbient,
  saveAmbientVersion,
  syncAmbientDraft,
} from "../ambient-operations" with { type: "ref" };

export const workspaceSpec: Spec = [
  // Anonymous visitors work here until they save, so the page resolves access itself instead of
  // being gated by the auth wrapper, which would bounce them to the landing page.
  route(
    "AmbientWorkspaceRoute",
    "/ambients/:ambientId",
    page(AmbientWorkspacePage),
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
  action(renameAmbient, { entities: ["Ambient", "AmbientDraft"] }),
  api("GET", "/ambient-workspaces/:ambientId/events", streamAmbientChanges, {
    auth: true,
    entities: ["Ambient"],
  }),
  apiNamespace("/ambient-workspaces", {
    middlewareConfigFn: ambientWorkspaceApiMiddleware,
  }),
];
