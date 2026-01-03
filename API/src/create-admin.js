import bcrypt from 'bcryptjs';

const password = 'Profesor764';
const hash = await bcrypt.hash(password, 10);
console.log('Password hash:', hash);
