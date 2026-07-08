import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const res = await supabase.from('users').select('id, first_name, last_name, role');
  console.log("USERS:", res.error || res.data?.length);
  
  const jRes = await supabase.from('journeys').select('id');
  console.log("JOURNEYS:", jRes.error || jRes.data?.length);
}
test();
