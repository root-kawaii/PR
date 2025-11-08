const bcrypt = require('bcryptjs');

const passwords = [
  { name: 'Demo123!', user: 'demo@pierre.com' },
  { name: 'Party2024!', user: 'mario@test.com' },
  { name: 'password123', user: 'test@example.com' }
];

async function hashPasswords() {
  for (const pwd of passwords) {
    const hash = await bcrypt.hash(pwd.name, 12);
    console.log(`-- ${pwd.user} / ${pwd.name}`);
    console.log(`'${hash}',`);
  }
}

hashPasswords();
