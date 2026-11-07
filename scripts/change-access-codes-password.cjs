const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://urqkvgbiwafhsxwvjkbr.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  console.log('\x1b[36m================================================\x1b[0m');
  console.log('\x1b[36m  Family Matters: Change Access Codes Password   \x1b[0m');
  console.log('\x1b[36m================================================\x1b[0m\n');

  let serviceKey = SERVICE_KEY;
  if (!serviceKey) {
    console.log('\x1b[33mNote: SUPABASE_SERVICE_ROLE_KEY not found in .env\x1b[0m');
    serviceKey = await askQuestion('Please enter your Supabase Service Role Key (or run via Supabase SQL Editor): ');
    if (!serviceKey) {
      console.log('\x1b[31mError: Service Role Key is required to update security settings via API.\x1b[0m');
      console.log('Tip: You can also run the SQL script in Supabase SQL Editor:');
      console.log('     SELECT public.set_access_codes_password(\'YourNewPassword\');\n');
      process.exit(1);
    }
  }

  let newPassword = process.argv[2];
  if (!newPassword) {
    newPassword = await askQuestion('Enter new master password for Access Codes section: ');
  }

  if (!newPassword || newPassword.trim().length < 6) {
    console.log('\x1b[31mError: Password must be at least 6 characters long.\x1b[0m\n');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, serviceKey);

  console.log('\nUpdating password in Supabase...');
  const { error } = await supabase.rpc('set_access_codes_password', {
    new_password: newPassword.trim(),
  });

  if (error) {
    console.error('\x1b[31mFailed to update password:\x1b[0m', error.message);
    process.exit(1);
  }

  console.log('\x1b[32m✔ Access Codes master password successfully updated!\x1b[0m');
  console.log('Changes will take effect immediately upon next unlock.\n');
}

main().catch((err) => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', err);
  process.exit(1);
});

