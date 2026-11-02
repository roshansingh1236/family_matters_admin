import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://urqkvgbiwafhsxwvjkbr.supabase.co';
// Get the Service Role Key from environment variable
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\x1b[31mError: SUPABASE_SERVICE_ROLE_KEY is missing.\x1b[0m');
  console.info('Please run this script as:');
  console.info('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/delete_user.js\n');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const USER_EMAIL_TO_DELETE = 'singhsachi49@gmail.com';

async function deleteUser() {
  console.log(`Searching for user with email: ${USER_EMAIL_TO_DELETE}...`);
  
  // 1. Fetch user by email via admin API (list users and filter)
  // Because admin API doesn't have a direct get-by-email for deletion
  const { data: { users }, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (fetchError) {
    console.error('Error fetching users:', fetchError);
    return;
  }

  const user = users.find(u => u.email === USER_EMAIL_TO_DELETE);

  if (!user) {
    console.log(`User ${USER_EMAIL_TO_DELETE} not found.`);
    return;
  }

  console.log(`User found! ID: ${user.id}. Deleting now...`);

  // 2. Delete the user
  const { data, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('Error deleting user:', deleteError);
  } else {
    console.log(`\x1b[32mSuccessfully deleted user ${USER_EMAIL_TO_DELETE}\x1b[0m`);
  }
}

deleteUser();
