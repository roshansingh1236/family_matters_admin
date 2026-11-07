/**
 * Generates a secure, temporary password for newly provisioned user accounts.
 * Contains uppercase, lowercase, numbers, and safe symbols.
 * Excludes easily confusable characters (like 0, O, I, l, 1) so users won't mistype them.
 */
export function generateRandomPassword(length = 10): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%*';

  // Ensure at least 1 uppercase, 1 lowercase, 1 digit, and 1 special symbol
  const parts = [
    uppers[Math.floor(Math.random() * uppers.length)],
    lowers[Math.floor(Math.random() * lowers.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  const all = uppers + lowers + digits + specials;
  const targetLength = Math.max(length, 8);
  for (let i = parts.length; i < targetLength; i++) {
    parts.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join('');
}

