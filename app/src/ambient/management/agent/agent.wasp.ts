import { action, api, page, route, type Spec } from "@wasp.sh/spec";

import { AgentPreviewPage } from "./agent-preview-page" with { type: "ref" };
import {
  agentApiMiddleware,
  agentWorkRoute,
  getAgentDocs,
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
  api("GET", "/agent/docs/:model/:version/:document", getAgentDocs, {
    auth: false,
    middlewareConfigFn: agentApiMiddleware,
  }),
  // Wasp has no PATCH method, so one ALL route dispatches every work method.
  api("ALL", "/agent/sessions/:capability/work", agentWorkRoute, {
    auth: false,
    middlewareConfigFn: agentApiMiddleware,
  }),
];
