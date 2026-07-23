import { action, page, query, route, type Spec } from "@wasp.sh/spec";

import { YourAmbientsPage } from "./YourAmbientsPage" with { type: "ref" };
import {
  createAmbient,
  deleteAmbient,
  listOwnedAmbients,
} from "../ambient-operations" with { type: "ref" };

export const librarySpec: Spec = [
  route(
    "YourAmbientsRoute",
    "/ambients",
    page(YourAmbientsPage, { authRequired: true }),
  ),
  query(listOwnedAmbients, { entities: ["Ambient", "AmbientDraft", "AmbientVersion"] }),
  action(createAmbient, { entities: ["Ambient", "AmbientDraft"] }),
  action(deleteAmbient, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
];
