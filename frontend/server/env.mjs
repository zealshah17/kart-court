import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Resolve relative to the project, including when launched from Finder.
for (const path of ['../.env', '../../.env']) {
  try {
    loadEnvFile(fileURLToPath(new URL(path, import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Could not load the project .env file. Check its format and file permissions.');
  }
}
