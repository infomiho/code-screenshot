# Ambient agent API

The temporary session URL is scoped to one ambient draft and expires after 24 hours. Never send it to another host.

## Workflow

1. Open the session URL and read both linked references.
2. `GET {sessionUrl}/draft` and use its current document as the starting point.
3. Ask the user to describe the intended visual direction before changing the draft.
4. Change the complete document and `PUT` it back with the current `baseRevision`.
5. Open the returned `previewUrl` in a browser and visually inspect the full ambient and thumbnail after every accepted update.

Use HTTP tools, not codeshot.dev repository edits.

## Read the draft

`GET {sessionUrl}/draft`

The response contains `ambientId`, `name`, `revision`, `document`, and `previewUrl`.

## Replace the draft

`PUT {sessionUrl}/draft`

Send `Content-Type: application/json` with the complete document, not a patch:

```json
{
  "baseRevision": 0,
  "document": {}
}
```

Set `baseRevision` to the revision returned by the latest GET. A successful update returns the next `revision` and `previewUrl`.

## Preview

Open the `previewUrl` returned by the draft and update endpoints. It uses the same client renderer, code editor, and picker thumbnail as codeshot.dev.

## Responses

- `409 draft_revision_conflict`: refetch the draft and reapply the change.
- `410 agent_session_expired`: ask the user for a new prompt.
- `422 ambient_invalid`: fix every diagnostic and resubmit the complete document.

A successful PUT confirms schema validity, not visual quality.
