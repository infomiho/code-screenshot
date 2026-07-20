import { type Auth } from "@wasp.sh/spec";

import { userSignupFields } from "./github" with { type: "ref" };

export const authConfig: Auth = {
  userEntity: "User",
  methods: {
    gitHub: { userSignupFields },
  },
  onAuthFailedRedirectTo: "/",
};
