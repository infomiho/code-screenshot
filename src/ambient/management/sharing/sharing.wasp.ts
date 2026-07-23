import { action, page, query, route, type Spec } from "@wasp.sh/spec";

import { SharedAmbientPage } from "./SharedAmbientPage" with { type: "ref" };
import {
  getSharedAmbient,
  setAmbientLinkSharing,
} from "../ambient-operations" with { type: "ref" };

export const sharingSpec: Spec = [
  route("SharedAmbientRoute", "/a/:shareId/:slug", page(SharedAmbientPage), { lazy: false }),
  query(getSharedAmbient, { entities: ["Ambient", "AmbientVersion"] }),
  action(setAmbientLinkSharing, { entities: ["Ambient"] }),
];
