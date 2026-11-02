import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const { data, error } = await supabase.from('surrogate_benefit_packages').select('*').limit(1);
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("DATA:", data);
  }
}
test();
