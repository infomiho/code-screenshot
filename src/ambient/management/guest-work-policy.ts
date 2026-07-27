type GuestDraftRevision = { revision: number; baseRevision?: number } | null

export const hasMeaningfulGuestDraft = (draft: GuestDraftRevision) =>
  (draft?.revision ?? 0) > 0

export const acceptedGuestChangeCount = (draft: GuestDraftRevision) =>
  draft?.baseRevision === undefined ? 0 : draft.revision - draft.baseRevision
