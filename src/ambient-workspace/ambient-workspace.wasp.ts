import { action, api, page, query, route, type Spec } from "@wasp.sh/spec";

import { AgentPreviewPage } from "./agent-preview-page" with { type: "ref" };
import { AmbientWorkspacePage } from "./AmbientWorkspacePage" with { type: "ref" };
import {
  agentApiMiddleware,
  getAgentDraft,
  getAgentSession,
  replaceAgentDraft,
} from "./agent-api" with { type: "ref" };
import {
  createAgentAccess,
  createAmbient,
  createDraftFromVersion,
  discardAgentAccess,
  discardAmbientDraft,
  getAmbientDraft,
  getAmbientDraftRevision,
  getAmbientWorkspace,
  listOwnedAmbients,
  saveAmbientVersion,
} from "./ambient-operations" with { type: "ref" };

export const ambientWorkspaceSpec: Spec = [
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
  query(getAmbientDraftRevision, { entities: ["Ambient", "AmbientDraft"] }),
  query(getAmbientDraft, { entities: ["Ambient", "AmbientDraft"] }),
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
];
