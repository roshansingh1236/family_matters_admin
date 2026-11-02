const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-key';

// Since we are in the admin portal dir, we can read the .env file
const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('users')
    .select('id, form_data, form2_data, parent1, parent2')
    .in('role', ['Intended Parent', 'intendedParent'])
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }
  
  data.forEach(d => {
    console.log(`ID: ${d.id}`);
    const fd = d.form_data || {};
    console.log(`  form_data.parent2 exists? ${!!fd.parent2}, type: ${typeof fd.parent2}`);
    if (fd.parent2) console.log(`  value: ${JSON.stringify(fd.parent2).substring(0, 100)}`);
  });
}

run();
