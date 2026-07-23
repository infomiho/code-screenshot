import { action, api, page, route, type Spec } from "@wasp.sh/spec";

import { AgentPreviewPage } from "./agent-preview-page" with { type: "ref" };
import {
  agentApiMiddleware,
  agentDraftRoute,
  getAgentSession,
} from "./agent-api" with { type: "ref" };
import {
  createAgentAccess,
  discardAgentAccess,
} from "../ambient-operations" with { type: "ref" };

export const agentSpec: Spec = [
  route("AgentPreviewRoute", "/agent-preview/:capability", page(AgentPreviewPage), { lazy: false }),
  action(createAgentAccess, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  action(discardAgentAccess, { entities: ["Ambient", "AmbientAgentSession"] }),
  api("GET", "/agent/sessions/:capability", getAgentSession, {
    auth: false,
    middlewareConfigFn: agentApiMiddleware,
  }),
  // Wasp has no PATCH method, so one ALL route dispatches GET, PUT, and PATCH for the draft.
  api("ALL", "/agent/sessions/:capability/draft", agentDraftRoute, {
    auth: false,
    middlewareConfigFn: agentApiMiddleware,
  }),
];
