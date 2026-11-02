import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const jRes = await supabase.from('journeys').select('*').limit(2);
  console.log("JOURNEYS:", JSON.stringify(jRes.data, null, 2));
}
test();
