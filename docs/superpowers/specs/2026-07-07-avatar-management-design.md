# Digital Human Avatar Management Design

## Goal

Add a management workflow for digital-human Live2D avatars. Operators can upload a new Live2D runtime zip package, keep it in an avatar library, edit display parameters, and manually activate it for the tourist page.

## Scope

Included:

- A new admin avatar management page linked from the existing admin dashboard.
- Upload of `.zip` Live2D runtime packages that contain at least one `.model3.json`.
- Storage of uploaded avatar assets under the frontend static asset tree.
- File-backed avatar metadata and active-avatar state.
- Editing of basic display parameters: name, role, max scale, stage width ratio, stage height ratio, anchor X/Y, offset X/Y.
- Manual activation of an uploaded or built-in avatar.
- Deletion of custom uploaded avatars.
- Tourist page loading of the active avatar from the backend manifest, with fallback to the existing static `characters.json`.

Excluded from this version:

- Uploading or converting `.cmo3` or `.can3` Live2D project files.
- Per-avatar TTS voice binding.
- Per-avatar persona or prompt customization.
- Automatic activation after upload.
- Database-backed persistence.

## Existing Context

The tourist page currently loads `src/frontend/assets/live2d/characters.json` and renders the selected model in `src/frontend/scripts/tourist-live2d.js`. The existing auto-fit logic already supports scale, stage ratio, anchor, and offset fields.

The management UI is static HTML and JavaScript:

- `src/frontend/admin.html`
- `src/frontend/scripts/admin.js`
- `src/frontend/styles/admin.css`

Knowledge management already uses a separate static workbench page. Avatar management should follow the same pattern.

## Backend Design

Add an avatar service responsible for:

- Reading and writing avatar metadata.
- Returning a default manifest that includes built-in `mao_pro` when no saved file exists.
- Validating uploaded zip packages.
- Extracting uploaded packages into a controlled custom-avatar directory.
- Activating one avatar at a time.
- Deleting custom avatar files and metadata.

Persistence:

- Metadata file: `src/backend/app_data/avatar_manifest.json`
- Uploaded assets: `src/frontend/assets/live2d/custom/<avatar_id>/`

The manifest shape should be:

```json
{
  "active_avatar_id": "mao_pro",
  "avatars": [
    {
      "id": "mao_pro",
      "name": "Mao Pro 导游",
      "role": "Live2D 示例数字人",
      "model": "./assets/live2d/mao_pro/mao_pro.model3.json",
      "built_in": true,
      "maxScale": 0.115,
      "stageWidthRatio": 0.44,
      "stageHeightRatio": 0.6,
      "anchorX": 0.5,
      "anchorY": 0.52,
      "offsetX": 0,
      "offsetY": -20
    }
  ]
}
```

## API Design

Public tourist endpoint:

- `GET /api/avatar/manifest`
  - Returns the active avatar and full avatar list.
  - Intended for tourist frontend startup.

Admin endpoints:

- `GET /api/admin/avatars`
  - Returns all avatars and `active_avatar_id`.
- `POST /api/admin/avatars/upload`
  - Multipart upload field: `file`.
  - Accepts only `.zip`.
  - Requires at least one `.model3.json` inside the package.
  - Adds the avatar to the library but does not activate it.
- `PATCH /api/admin/avatars/{avatar_id}`
  - Updates editable display fields.
- `POST /api/admin/avatars/{avatar_id}/activate`
  - Sets the active avatar.
- `DELETE /api/admin/avatars/{avatar_id}`
  - Deletes custom avatars only.
  - Built-in avatars return an error.

## Upload Validation

The upload handler must reject:

- Empty files.
- Non-zip filenames or invalid zip bytes.
- Packages without `.model3.json`.
- Zip entries with absolute paths.
- Zip entries with `..` path traversal.
- Oversized zip files.
- Oversized extracted content.

When multiple `.model3.json` files exist, use the shortest path as the default model entry. This favors top-level runtime packages while still tolerating nested folders.

## Frontend Admin Design

Add `src/frontend/avatar.html`, `src/frontend/scripts/avatar.js`, and `src/frontend/styles/avatar.css`.

The page should include:

- Header with links back to the dashboard and knowledge management.
- Current active avatar summary.
- Upload form for `.zip` packages.
- Avatar list with built-in/custom badges.
- Editor form for selected avatar display parameters.
- Activate and delete actions.

Built-in avatars:

- Can be activated.
- Can have display parameters edited.
- Cannot be deleted.

Custom avatars:

- Can be activated.
- Can have display parameters edited.
- Can be deleted when not needed.

## Tourist Frontend Design

Update `tourist-live2d.js` so `loadCharacters` tries:

1. `http://127.0.0.1:8001/api/avatar/manifest`
2. Existing `./assets/live2d/characters.json` fallback

The loaded character list should remain compatible with existing `autoFitModel` and `loadModel`. If the active avatar id is present, the tourist page should load it first. If the backend is unavailable, the current static Mao Pro behavior must continue working.

## Error Handling

Admin upload and edit actions should show user-readable status messages.

Backend errors should use clear HTTP statuses:

- `400` for invalid fields or invalid zip packages.
- `404` for unknown avatar ids.
- `409` for duplicate or conflicting avatar state.
- `413` for package size limits.

Tourist startup should not fail hard when the backend manifest endpoint is unavailable. It should fall back to the existing static manifest.

## Testing

Add focused contract tests for:

- Avatar manifest defaults include built-in Mao Pro.
- Upload rejects zip packages without `.model3.json`.
- Upload rejects zip path traversal.
- Upload adds a custom avatar without activating it.
- Activation changes the public tourist manifest.
- Built-in avatars cannot be deleted.
- Tourist script contains backend manifest loading and static fallback behavior.

## Open Decisions Resolved

- Upload format: `.zip` package only.
- Upload behavior: add to library, do not auto-activate.
- Editable fields: basic display parameters only.
- Implementation approach: file-backed metadata plus frontend static asset directory.
