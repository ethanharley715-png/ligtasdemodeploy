import crypto from 'crypto';

/**
 * Verifies password against stored PBKDF2 hash.
 * Uses email+password as combined input, salt extracted from stored hash.
 */
export function verifyPassword(
  email: string,
  password: string,
  storedHash: string
): boolean {
  return verifyPasswordWithUsername(email, password, storedHash);
}

/**
 * Hashes a password using PBKDF2 (for seeding users table).
 * Must match verifyPasswordWithUsername verification logic.
 */
export function hashPasswordWithUsername(username: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iterations = 10000;
  const keyLength = 32;
  const digest = 'sha256';
  const combinedString = username + password;

  const derivedKey = crypto.pbkdf2Sync(
    Buffer.from(combinedString, 'utf8'),
    salt,
    iterations,
    keyLength,
    digest
  );

  // Format: [formatMarker 1 byte][salt 16 bytes][derivedKey 32 bytes]
  const formatMarker = 1;
  const hashBuffer = Buffer.alloc(1 + 16 + 32);
  hashBuffer[0] = formatMarker;
  salt.copy(hashBuffer, 1);
  derivedKey.copy(hashBuffer, 17);

  return hashBuffer.toString('base64');
}

/**
 * Verifies the password against the hash stored in the database.
 * @param {string} username - The username associated with the password
 * @param {string} password - The plaintext password to verify
 * @param {string} storedHash - The hash (Base64) stored in the database
 * @returns {boolean} - Whether the password matches the stored hash
 */
export function verifyPasswordWithUsername(username: string, password: string, storedHash: string): boolean {
    // Decode the Base64 stored hash
    const decodedHash = Buffer.from(storedHash, 'base64');

    // Extract the format marker, salt, and derived key
    const _formatMarker = decodedHash[0];  // Format marker (reserved for future versioning)
    const salt = decodedHash.slice(1, 17);  // Salt (16 bytes)
    const storedDerivedKey = decodedHash.slice(17);  // The derived key (hashed password)

    // PBKDF2 parameters (must match the ones used when hashing)
    const iterations = 10000;
    const keyLength = 32;  // 32-byte derived key
    const digest = 'sha256';

    // Combine the username and password to create a unique combined string for each user
    const combinedString = username + password;

    // Derive the key using PBKDF2-HMAC-SHA256 with the combined string as the password
    const derivedKey = crypto.pbkdf2Sync(
        Buffer.from(combinedString, 'utf8'),
        salt,
        iterations,
        keyLength,
        digest
    );

    // Constant-time comparison to prevent timing attacks
    const isMatch = crypto.timingSafeEqual(derivedKey, storedDerivedKey);

    return isMatch;
}
