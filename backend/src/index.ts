import 'dotenv/config';
import { createApp } from './app';
import { getSupabaseConfig } from './services/supabase';
getSupabaseConfig();
const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
createApp().listen(port, '127.0.0.1', () => console.log(`Kart Court backend: http://localhost:${port}`));
