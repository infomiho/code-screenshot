import { action, api, apiNamespace, page, query, route, type Spec } from "@wasp.sh/spec";

import { AgentPreviewPage } from "./agent-preview-page" with { type: "ref" };
import { AmbientWorkspacePage } from "./AmbientWorkspacePage" with { type: "ref" };
import { YourAmbientsPage } from "./YourAmbientsPage" with { type: "ref" };
import {
  agentApiMiddleware,
  agentDraftRoute,
  getAgentSession,
} from "./agent-api" with { type: "ref" };
import {
  ambientWorkspaceApiMiddleware,
  streamAmbientChanges,
} from "./ambient-change-stream" with { type: "ref" };
import {
  createAgentAccess,
  createAmbient,
  createDraftFromVersion,
  deleteAmbient,
  discardAgentAccess,
  discardAmbientDraft,
  getAmbientWorkspace,
  listOwnedAmbients,
  saveAmbientVersion,
  syncAmbientDraft,
} from "./ambient-operations" with { type: "ref" };

export const ambientWorkspaceSpec: Spec = [
  route(
    "YourAmbientsRoute",
    "/ambients",
    page(YourAmbientsPage, { authRequired: true }),
  ),
  route(
    "AmbientWorkspaceRoute",
    "/ambients/:ambientId",
    page(AmbientWorkspacePage, { authRequired: true }),
  ),
  route("AgentPreviewRoute", "/agent-preview/:capability", page(AgentPreviewPage), { lazy: false }),
  query(listOwnedAmbients, { entities: ["Ambient", "AmbientDraft", "AmbientVersion"] }),
  query(getAmbientWorkspace, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  query(syncAmbientDraft, { entities: ["Ambient", "AmbientDraft"] }),
  action(createAmbient, { entities: ["Ambient", "AmbientDraft"] }),
  action(createAgentAccess, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(discardAgentAccess, { entities: ["Ambient", "AmbientAgentSession"] }),
  action(discardAmbientDraft, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(createDraftFromVersion, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(saveAmbientVersion, { entities: ["Ambient", "AmbientDraft", "AmbientVersion"] }),
  action(deleteAmbient, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  api("GET", "/agent/sessions/:capability", getAgentSession, {
    auth: false,
    middlewareConfigFn: agentApiMiddleware,
  }),
  // Wasp has no PATCH method, so one ALL route dispatches GET, PUT, and PATCH for the draft.
  api("ALL", "/agent/sessions/:capability/draft", agentDraftRoute, {
    auth: false,
    middlewareConfigFn: agentApiMiddleware,
  }),
  api("GET", "/ambient-workspaces/:ambientId/events", streamAmbientChanges, {
    auth: true,
    entities: ["Ambient"],
  }),
  apiNamespace("/ambient-workspaces", {
    middlewareConfigFn: ambientWorkspaceApiMiddleware,
  }),
];
