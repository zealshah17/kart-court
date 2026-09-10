# Product Court

A responsive, interactive pixel-art furniture courtroom based on the supplied reference.

## Run

Requires Node.js 22 or later. No dependencies are needed.

**On this Mac:** double-click **Start Product Court.command** in Finder. It opens a normal Terminal window and starts the app independently of Codex. Keep that window open, then visit **http://localhost:5173** in Chrome, Safari, or Firefox. Press **Control+C** in Terminal to stop it. Run the launcher again after restarting your Mac.

**On your phone or another device:** connect to the same Wi-Fi as your Mac and open the **On the same Wi-Fi** address printed in Terminal. Use that address rather than `localhost` on the other device. The Mac must remain awake with the server running. If macOS asks, allow Node.js to accept incoming connections. Some guest or workplace networks block connections between devices.

Alternatively, run this in your own Terminal from the project folder:

```sh
npm run dev
```

Keep the Terminal command running while testing. `ERR_CONNECTION_REFUSED` means the browser cannot reach a listening server; restart the launcher if its Terminal window was closed. Run `npm run check` to check JavaScript syntax. Deploy the `dist` directory to any static host.

## OpenAI connection

Add your key to the project-root `.env` file:

```dotenv
OPENAI_API_KEY=your_key_here
```

The server loads `.env` automatically on startup. Restart the Terminal server after changing it. Existing exported environment variables take precedence. `.env` is ignored by Git and lives outside the browser-served `dist` folder. `.env.example` is a safe template for other checkouts.

Run this in Terminal from the project folder to verify authentication:

```sh
npm run openai:check
```

The check calls OpenAI's [list models endpoint](https://developers.openai.com/api/reference/resources/models/methods/list) using server-side [Bearer authentication](https://developers.openai.com/api/reference/overview). It only prints success or a sanitized error; it does not print the key or generate text/images. A successful check confirms model-list access, not generation permissions or available quota. The standalone dialogue generator below is available; frontend generation, image generation, and room-photo analysis are not connected yet. No API key is sent to the frontend.

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

## Generate a GPT conversation

`server/generate-conversation.mjs` exports `generateConversation(row)` for a single `product_extractions` row. It uses `product`, `reviews`, and `extraction` warnings; optional `roomContext` is user-provided text, not image analysis. It does not fetch Amazon or query Supabase.

Try the supplied Dowinx extraction snapshot (this makes a paid text-generation API request):

```sh
npm run conversation:generate -- examples/product-row.json
```

Replace the filename with your exported database row to generate a real product conversation. The JSON file must contain a `product` object with `title` or `name`; `reviews` can be an empty array. Up to 40 review excerpts are used.

The result contains eight alternating `lines`, each with `speaker`, short `text`, and `evidence` IDs, plus `missingEvidence` and `reviewCoverage`. Angel presents supported pros; Devil challenges with cons, tradeoffs, or unanswered questions. The prompt requests funny responses to the previous speaker and forbids inventing evidence. References and formatting are validated; factual grounding still needs review. The browser’s Test case button plays these generated lines through the hearing controller.

The default is `gpt-6-astra` with `reasoning.effort: low` to prioritize latency; optionally add `OPENAI_TEXT_MODEL=gpt-6-astra` to `.env`. The generator uses the [Responses API with Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Keys stay server-side, and raw API errors are not printed.

### Backend response and review context

Pass the full parsed backend response directly:

```js
import { generateConversation } from './server/generate-conversation.mjs';
const conversation = await generateConversation(backendRow);
// conversation.lines contains the alternating Angel and Devil dialogue.
```

`server/product-context.mjs` normalizes the supplied payload. It retains product title, price, rating/count, bullet points, specifications, and extraction warnings, while removing internal widget JSON appended to availability. Markdown-wrapped source links are unwrapped; images are not analyzed by this text generator.

Reviews supplied in `backendRow.reviews` automatically enter the GPT context. It supports `body`, `text`, `content`, or `reviewText` plus title, rating, ID, and variant. Author names are excluded. Evidence IDs refer to the original review-array index even if empty entries are skipped. Up to 40 readable excerpts are used, with sample counts returned in `reviewCoverage`. Call the generator again after your backend has populated reviews to include the new evidence.

The Dowinx example has a listed 4.5 rating and 517 ratings, but an empty reviews array. Those aggregate numbers are not review text. For this case the prompt asks GPT to state that readable reviews were unavailable, use seller claims with attribution, and raise practical questions instead of fabricating customer complaints. When reviews arrive, the prompt asks for their supported positive and negative experiences. The prompt also distinguishes the selected PU White variant from the alternative Tech Cloth description.

### Generation timeout

Dialogue generation allows 180 seconds by default. Override with `OPENAI_TIMEOUT_MS=180000` in `.env` (maximum 600000). The CLI prints elapsed-time updates to stderr while keeping stdout as the conversation JSON. Timeout, DNS, and certificate failures have separate messages. Requests are not automatically retried, because a timed-out request may still have been processed by OpenAI. If a connection fails, run `npm run openai:check` to check reachability and authentication separately.

### Test dialogue in the browser

Restart the server using `Start Product Court.command`, open http://localhost:5173, and click **Test case · Generate dialogue**. The server reads `examples/product-row.json` each time and calls OpenAI using your server-side `.env` key. Add a valid link and room photo to enable the button. Each click makes a paid text-generation request and a separate image-edit request; Objection replays the result without another API call. Click anywhere to advance one speaker at a time.

Add reviews to the example JSON and click Test case again to include them. The evidence board stays blank until generation succeeds. Errors appear below the test button; no demo dialogue substitutes for failed generation. This test uses the saved product only: Amazon link extraction, room-image analysis, and generated room previews are deferred. Uploaded room photos remain local; product photos and the courtroom style reference are sent to the image API.

The evidence board builds compact cards from each case: listing facts, dimensions, review coverage, generated arguments, and missing evidence. Uploaded photos and personal notes are separate cards. Select a card for details or to add optional measurements; there is no required sofa-width questionnaire. Local measurements and notes update the board but are not sent in the current saved-product conversation test.

### Independent artwork panels

The left `.scene` uses `dist/assets/IMG_5950.png`. The right `.board` has its own decorative SVG viewport showing only the board region of `dist/assets/courtroom-empty-evidence-board.png`. The full original screenshot is no longer the page background. Dynamic evidence cards sit over the blank parchment; the illustrated heading and footer belong to the board artwork. On narrow screens the board stacks below the courtroom. Characters and bubbles remain independent layers.

### Pixel-art product sprite

Every Test case/Test again click now requests a fresh product sprite alongside the conversation. `server/generate-product-sprite.mjs` contains the image prompt, sends the original Amazon product image plus the courtroom style reference to the Images edits API, and requests a transparent PNG. The default `OPENAI_IMAGE_MODEL` is `gpt-image-2.5-sunburst`. Set another model only if it supports image edits and transparent output. See the [official image-generation guide](https://developers.openai.com/api/docs/guides/image-generation).

The original listing photo stays on the evidence board; only the generated sprite appears on the pedestal. The sprite is an illustration and can differ from the real product. Neither source image is overwritten. The conversation still uses listing/review evidence, not the generated image. Each click can take several minutes and incurs separate image-generation usage; replaying with Objection is free of additional generation requests. No automatic retries or sprite caching are used. Image errors leave the pedestal empty while preserving successful dialogue. Restart the Node server after updating these server files.
