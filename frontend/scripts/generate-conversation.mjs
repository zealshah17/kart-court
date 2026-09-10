import { readFile } from 'node:fs/promises';
import { generateConversation } from '../server/generate-conversation.mjs';

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: npm run conversation:generate -- path/to/product-row.json');
  process.exitCode = 1;
} else {
  let row;
  try { row = JSON.parse(await readFile(filename, 'utf8')); }
  catch { console.error('Could not read the product JSON file. Check its path and JSON syntax.'); process.exitCode = 1; }
  if (!process.exitCode) {
    const started = Date.now();
    console.error('Generating dialogue with OpenAI…');
    const progress = setInterval(() => console.error(`Still generating… ${Math.round((Date.now() - started) / 1000)} seconds elapsed.`), 15000);
    progress.unref();
    try {
      console.log(JSON.stringify(await generateConversation(row), null, 2));
      console.error(`Completed in ${((Date.now() - started) / 1000).toFixed(1)} seconds.`);
    }
    catch (error) { console.error(error.message); process.exitCode = 1; }
    finally { clearInterval(progress); }
  }
}
