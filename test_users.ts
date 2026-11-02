import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data } = await supabase.from('users').select('id, first_name, last_name, role').eq('id', '73b71af9-de15-4678-b636-0dc9845e9a3e');
  console.log("USER:", data);
}
test();
