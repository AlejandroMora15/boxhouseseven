import bcrypt from "bcryptjs";

const ROUNDS = 10;

// Hash válido de una cadena aleatoria: se compara cuando el correo no existe
// para que la respuesta tarde lo mismo y no revele qué correos están creados.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Y5KX5aZJ2a1o8gQ9ZbKqMZ8sQ6Pe";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
