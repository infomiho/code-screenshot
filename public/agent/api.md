# Ambient agent API

The temporary session URL is scoped to one ambient draft and expires after 24 hours. Never send it to another host.

## Workflow

1. Open the session URL and read both linked references.
2. `GET {sessionUrl}/draft` and use its current document as the starting point.
3. Ask the user to describe the intended visual direction before changing the draft.
4. Change the document and write it back: `PUT` the complete document, or `PATCH` only the fields that change. Send the current `baseRevision` either way.
5. Open the returned `previewUrl` in a browser and visually inspect the full ambient and thumbnail after every accepted update.

Use HTTP tools, not codeshot.dev repository edits.

## Read the draft

`GET {sessionUrl}/draft`

The response contains `ambientId`, `name`, `revision`, `document`, and `previewUrl`.

## Replace the draft

`PUT {sessionUrl}/draft`

Send `Content-Type: application/json` with the complete document:

```json
{
  "baseRevision": 0,
  "document": {}
}
```

Set `baseRevision` to the revision returned by the latest GET. A successful update returns the next `revision` and `previewUrl`.

## Patch the draft

`PATCH {sessionUrl}/draft`

Send `Content-Type: application/json` with only the fields that change (JSON Merge Patch, RFC 7396):

```json
{
  "baseRevision": 0,
  "patch": { "editor": { "tokens": { "keyword": "#b45f2c" } } }
}
```

The patch is applied to the stored draft, then validated as a complete document. Objects merge recursively. Arrays such as `customizations` are replaced wholesale, so send the full array when changing one entry. Every document field is required, so a `null` (which removes a key) makes the result invalid. Prefer PATCH for small edits and PUT when restructuring the whole document.

## Preview

Open the `previewUrl` returned by the draft and update endpoints. It renders with the same engine as codeshot.dev.

## Responses

- `405 method_not_allowed`: the draft endpoint accepts only GET, HEAD, PUT, and PATCH.
- `409 draft_revision_conflict`: refetch the draft and reapply the change.
- `410 agent_session_expired`: ask the user for a new prompt.
- `422 ambient_invalid`: fix every diagnostic and resubmit (the complete document for PUT, the patch for PATCH).

A successful PUT or PATCH confirms schema validity, not visual quality.
