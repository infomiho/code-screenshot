import { action, api, page, query, route, type Spec } from "@wasp.sh/spec";

import { AgentPreviewPage } from "./agent-preview-page" with { type: "ref" };
import {
  agentApiMiddleware,
  getAgentDraft,
  getAgentSession,
  replaceAgentDraft,
} from "./agent-api" with { type: "ref" };
import {
  createAmbient,
  createAmbientAgentSession,
  discardAmbientDraft,
  getAmbientDraft,
  getAmbientDraftRevision,
  getAmbientWorkspace,
  publishAmbient,
} from "./ambient-operations" with { type: "ref" };

export const ambientWorkspaceSpec: Spec = [
  route("AgentPreviewRoute", "/agent-preview/:capability", page(AgentPreviewPage), {
    lazy: false,
  }),
  query(getAmbientWorkspace, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  query(getAmbientDraftRevision, { entities: ["Ambient", "AmbientDraft"] }),
  query(getAmbientDraft, { entities: ["Ambient", "AmbientDraft"] }),
  action(createAmbient, { entities: ["Ambient", "AmbientDraft", "AmbientAgentSession"] }),
  action(createAmbientAgentSession, {
    entities: ["User", "Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(discardAmbientDraft, {
    entities: ["User", "Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
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
];
