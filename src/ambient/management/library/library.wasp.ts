import { action, job, page, query, route, type Spec } from "@wasp.sh/spec";

import { YourAmbientsPage } from "./YourAmbientsPage" with { type: "ref" };
import { collectAbandonedGuestWork } from "../guest-cleanup" with { type: "ref" };
import {
  claimGuestAmbients,
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
  action(claimGuestAmbients, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession", "GuestSession"],
  }),
  action(deleteAmbient, {
    entities: ["Ambient", "AmbientDraft", "AmbientVersion", "AmbientAgentSession"],
  }),
  // Every landing call to action creates a row, so abandoned anonymous work is swept hourly.
  job(collectAbandonedGuestWork, {
    executor: "PgBoss",
    schedule: { cron: "17 * * * *" },
    entities: ["Ambient", "GuestSession"],
  }),
];
