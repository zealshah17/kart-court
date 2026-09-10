# Product Court

A responsive, interactive pixel-art furniture courtroom based on the supplied reference.

## Run

Requires Node.js 18 or later. No dependencies are needed.

**On this Mac:** double-click **Start Product Court.command** in Finder. It opens a normal Terminal window and starts the app independently of Codex. Keep that window open, then visit **http://localhost:5173** in Chrome, Safari, or Firefox. Press **Control+C** in Terminal to stop it. Run the launcher again after restarting your Mac.

**On your phone or another device:** connect to the same Wi-Fi as your Mac and open the **On the same Wi-Fi** address printed in Terminal. Use that address rather than `localhost` on the other device. The Mac must remain awake with the server running. If macOS asks, allow Node.js to accept incoming connections. Some guest or workplace networks block connections between devices.

Alternatively, run this in your own Terminal from the project folder:

```sh
npm run dev
```

Keep the Terminal command running while testing. `ERR_CONNECTION_REFUSED` means the browser cannot reach a listening server; restart the launcher if its Terminal window was closed. Run `npm run check` to check JavaScript syntax. Deploy the `dist` directory to any static host.

## Features

- Product link validation and editable product name and width.
- Local room photo uploads (PNG/JPG/WebP, up to 5 photos, 10 MB per photo), with previews.
- Evidence notes and measurements in cm, m, inches, or feet.
- Angel/devil arguments and a deterministic fit verdict based on actual user-entered dimensions, with 10 cm clearance.
- Click-to-advance, alternating character dialogue when you click **Objection!** or either character. Both speech bubbles are hidden at rest. Only the active speaker’s bubble and dialogue appear; the other listens with a closed mouth. Bubbles size to their text. Click or tap anywhere on the page, or press Enter or Space, for the next line; the final click opens the verdict. There is no autoplay timer or toolbar. Escape ends the hearing and hides both bubbles. Switching browser tabs pauses it until you return. Dialogue responds to the current fit evidence. Reduced-motion preferences disable mouth animation.
- Keyboard-accessible dialogs, live status updates, and a mobile evidence-board layout.

Session data stays in memory; reloading resets the court. Photos never leave the browser. Product links are recorded, not scraped. The app does not perform AI photo analysis. The initial room/product are example evidence from the reference.

## Artwork

The courtroom uses independent, unchanged assets supplied in `dist/assets/`:

- `IMG_5950.png`: clean courtroom background.
- `IMG_9590.png`: transparent Angel character.
- `devil-cutout.png angel-cutout.png`: transparent Devil character (one filename).
- `IMG_5006.png`: Angel’s empty speech bubble.
- `textbubbleleft.png textbubbleright.png court room.png`: Devil’s empty speech bubble (one filename).

Bubble art provides the frame; dialogue is live text, with no extra textbox. Characters, bubbles, the exhibit, and room preview are independently positioned. The original `courtroom.png` remains unchanged and supplies the existing evidence-board decoration, sample room, and clipped sample chair. Mobile layout rearranges the board for readability.

The optional WebMCP measurement tool is feature-detected. It is not required for ordinary browser use.

Character animation uses small pixel-style mouth overlays over the character layers; it does not yet include separate arm sprites or spoken audio. Run `npm test` to verify manual advancement, pause/resume, cancellation, and completion.
