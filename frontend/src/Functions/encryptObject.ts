/* ========================================
   Types
======================================== */

/**
 * Structure sent to backend after encryption.
 * - encryptedKey: AES key encrypted with RSA
 * - iv: AES-GCM initialization vector
 * - data: AES-encrypted payload (includes auth tag)
 */
export interface EncryptedPayload {
    encryptedKey: string;
    iv: string;
    data: string;
}

/* ========================================
   Hybrid Encryption Function
   RSA-OAEP + AES-256-GCM
======================================== */

/**
 * Encrypts any object using hybrid encryption:
 * 1. Generates random AES-256 key
 * 2. Encrypts object with AES-GCM
 * 3. Encrypts AES key with RSA-OAEP (SHA-256)
 * 4. Returns Base64-encoded payload
 */
export async function encryptObject<T>(
    obj: T,
    pemPublicKey: string
): Promise<EncryptedPayload> {

    /* ----------------------------------------
       1. Serialize object to Uint8Array
    ---------------------------------------- */
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(obj));

    /* ----------------------------------------
       2. Generate AES-256-GCM key
    ---------------------------------------- */
    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    /* ----------------------------------------
       3. Encrypt data using AES-GCM
       - 96-bit IV (recommended for GCM)
    ---------------------------------------- */
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        data
    );

    /* ----------------------------------------
       4. Import RSA public key (PEM → CryptoKey)
    ---------------------------------------- */
    const cleanedPem = pemPublicKey
        .replace(/-----BEGIN PUBLIC KEY-----/, "")
        .replace(/-----END PUBLIC KEY-----/, "")
        .replace(/\s+/g, "");

    const binaryDer = Uint8Array.from(atob(cleanedPem), c =>
        c.charCodeAt(0)
    );

    const rsaKey = await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );

    /* ----------------------------------------
       5. Encrypt AES key using RSA-OAEP
    ---------------------------------------- */
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    const encryptedAesKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        rsaKey,
        rawAesKey
    );

    /* ----------------------------------------
       6. Convert ArrayBuffer → Base64
    ---------------------------------------- */
    const toBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
        const bytes =
            buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        return btoa(String.fromCharCode(...bytes));
    };

    /* ----------------------------------------
       Return encrypted payload
    ---------------------------------------- */
    return {
        encryptedKey: toBase64(encryptedAesKey),
        iv: toBase64(iv),
        data: toBase64(encryptedData),
    };
}