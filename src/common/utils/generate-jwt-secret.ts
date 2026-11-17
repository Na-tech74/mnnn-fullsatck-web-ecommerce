//RUN: npx ts-node generate-jwt-secret.ts

import { randomBytes } from 'crypto';

export function generateJwtSecret(bytes = 64): string {
    return randomBytes(bytes).toString('hex'); // 64 byte -> chuỗi 128 ký tự
}

console.log(generateJwtSecret());