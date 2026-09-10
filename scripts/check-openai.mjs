import { checkOpenAIConnection } from '../server/openai.mjs';

try {
  await checkOpenAIConnection();
  console.log('OpenAI connection successful. No text or images were generated.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
