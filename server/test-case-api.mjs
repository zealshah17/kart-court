import { generateProductSprite } from './generate-product-sprite.mjs';
import { readFile } from 'node:fs/promises';
import { generateConversation } from './generate-conversation.mjs';
import { buildProductContext } from './product-context.mjs';
import { productDimensions } from './case-input.mjs';

export function createTestCaseHandler({ generate = generateConversation, generateSprite = generateProductSprite,
  loadRow = async () => JSON.parse(await readFile(new URL('../examples/product-row.json', import.meta.url), 'utf8')),
} = {}) {
  let busy = false;
  return async (req, res) => {
    const send = (status, data) => {
      if (!res.destroyed) res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
    };
    if (req.method !== 'POST') { send(405, { error: 'Use POST to generate a test case.' }); return; }
    let sameOrigin = false;
    try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch {}
    if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') { send(403, { error: 'Generate a test case from the Product Court page.' }); return; }
    if (busy) { send(429, { error: 'A case is already generating. Please wait.' }); return; }
    busy = true;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      // Read afresh on every click so newly added reviews enter the prompt.
      const row = await loadRow();
      const context = buildProductContext(row);
      const [textResult, imageResult] = await Promise.allSettled([
        generate(row, { signal: controller.signal }),
        generateSprite(row, { signal: controller.signal }),
      ]);
      if (textResult.status === 'rejected') throw textResult.reason;
      const conversation = textResult.value;
      const spriteImage = imageResult.status === 'fulfilled' ? imageResult.value : null;
      const spriteError = imageResult.status === 'rejected' ? imageResult.reason.message : null;
      send(200, { conversation, product: context.product, dimensions: productDimensions(context.product),
        source: 'examples/product-row.json', spriteImage, spriteError, imageUrl: row.product.imageUrl || null });
    } catch (error) {
      send(502, { error: error?.code ? 'Could not read the example product JSON.' : error.message || 'Could not generate the test case.' });
    } finally { busy = false; res.off('close', cancel); }
  };
}
