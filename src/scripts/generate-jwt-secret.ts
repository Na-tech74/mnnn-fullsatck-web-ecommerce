// RUN: npx ts-node src/scripts/generate-jwt-secret.ts

import { randomBytes } from 'crypto';

export function generateJwtSecret(bytes = 64): string {
  return randomBytes(bytes).toString('hex');
}

console.log(generateJwtSecret());
