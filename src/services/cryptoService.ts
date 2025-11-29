import crypto from "crypto";

/**
 * Servicio de criptografía para SecureTransfer
 * Implementa cifrado simétrico (AES-256-GCM), asimétrico (RSA-2048),
 * hashing (SHA-256) y firma digital
 */

// Constantes
const AES_ALGORITHM = "aes-256-gcm";
const AES_KEY_LENGTH = 32; // 256 bits
const AES_IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits para GCM

const RSA_ALGORITHM = "rsa";
const RSA_MODULUS_LENGTH = 2048;
const HASH_ALGORITHM = "sha256";

// Tipos
export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export interface KeyPair {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
}

/**
 * Genera una clave de sesión aleatoria de 32 bytes para AES-256
 * @returns Buffer de 32 bytes
 */
export function generateSessionKey(): Buffer {
  return crypto.randomBytes(AES_KEY_LENGTH);
}

/**
 * Cifra datos usando AES-256-GCM (cifrado autenticado)
 * @param buffer - Datos a cifrar
 * @param key - Clave de cifrado de 32 bytes
 * @returns Objeto con ciphertext, IV y authTag
 */
export function aesEncrypt(buffer: Buffer, key: Buffer): EncryptedData {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error(`La clave debe tener ${AES_KEY_LENGTH} bytes`);
  }

  // Generar IV aleatorio
  const iv = crypto.randomBytes(AES_IV_LENGTH);

  // Crear cipher
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

  // Cifrar datos
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);

  // Obtener auth tag (solo disponible después de cipher.final())
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv,
    authTag,
  };
}

/**
 * Descifra datos usando AES-256-GCM
 * @param cipherBuffer - Datos cifrados
 * @param key - Clave de descifrado de 32 bytes
 * @param iv - Vector de inicialización
 * @param authTag - Tag de autenticación (requerido para GCM)
 * @returns Buffer con datos descifrados
 */
export function aesDecrypt(
  cipherBuffer: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error(`La clave debe tener ${AES_KEY_LENGTH} bytes`);
  }

  if (!authTag) {
    throw new Error("authTag es requerido para AES-GCM");
  }

  // Crear decipher
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);

  // Establecer auth tag
  decipher.setAuthTag(authTag);

  // Descifrar datos
  const plaintext = Buffer.concat([
    decipher.update(cipherBuffer),
    decipher.final(), // Lanzará error si la autenticación falla
  ]);

  return plaintext;
}

/**
 * Genera hash SHA-256 de un buffer
 * @param buffer - Datos a hashear
 * @returns Hash en formato hexadecimal
 */
export function hash(buffer: Buffer): string {
  return crypto.createHash(HASH_ALGORITHM).update(buffer).digest("hex");
}

/**
 * Genera un par de claves RSA (pública/privada) de 2048 bits
 * @returns Objeto con claves pública y privada en formato PEM
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync(RSA_ALGORITHM, {
    modulusLength: RSA_MODULUS_LENGTH,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      // Opcionalmente puedes agregar cifrado a la clave privada:
      // cipher: 'aes-256-cbc',
      // passphrase: 'tu-passphrase-aqui'
    },
  });

  return {
    publicKey,
    privateKey,
  };
}

/**
 * Cifra la clave de sesión usando la clave pública RSA
 * @param sessionKey - Clave de sesión a cifrar (Buffer)
 * @param publicKeyPem - Clave pública en formato PEM
 * @returns Buffer con la clave de sesión cifrada
 */
export function encryptWithPublicKey(
  sessionKey: Buffer,
  publicKeyPem: string
): Buffer {
  return crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    sessionKey
  );
}

/**
 * Descifra la clave de sesión usando la clave privada RSA
 * @param encryptedSessionKey - Clave de sesión cifrada
 * @param privateKeyPem - Clave privada en formato PEM
 * @returns Buffer con la clave de sesión descifrada
 */
export function decryptWithPrivateKey(
  encryptedSessionKey: Buffer,
  privateKeyPem: string
): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedSessionKey
  );
}

/**
 * Firma un hash usando la clave privada RSA
 * @param hashToSign - Hash a firmar (string hexadecimal o Buffer)
 * @param privateKeyPem - Clave privada en formato PEM
 * @returns Buffer con la firma digital
 */
export function sign(
  hashToSign: string | Buffer,
  privateKeyPem: string
): Buffer {
  // Convertir hash hex a buffer si es necesario
  const hashBuffer =
    typeof hashToSign === "string"
      ? Buffer.from(hashToSign, "hex")
      : hashToSign;

  return crypto.sign(HASH_ALGORITHM, hashBuffer, {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });
}

/**
 * Verifica una firma digital usando la clave pública RSA
 * @param signature - Firma a verificar
 * @param hashToVerify - Hash original (string hexadecimal o Buffer)
 * @param publicKeyPem - Clave pública en formato PEM
 * @returns true si la firma es válida, false en caso contrario
 */
export function verify(
  signature: Buffer,
  hashToVerify: string | Buffer,
  publicKeyPem: string
): boolean {
  // Convertir hash hex a buffer si es necesario
  const hashBuffer =
    typeof hashToVerify === "string"
      ? Buffer.from(hashToVerify, "hex")
      : hashToVerify;

  try {
    return crypto.verify(
      HASH_ALGORITHM,
      hashBuffer,
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      signature
    );
  } catch (error) {
    // Si hay error en la verificación, retornar false
    return false;
  }
}

/**
 * Utilidad: Convierte un buffer a string base64 (para transmisión)
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

/**
 * Utilidad: Convierte un string base64 a buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/**
 * Utilidad: Serializa datos cifrados para transmisión/almacenamiento
 */
export function serializeEncryptedData(data: EncryptedData): string {
  return JSON.stringify({
    ciphertext: bufferToBase64(data.ciphertext),
    iv: bufferToBase64(data.iv),
    authTag: bufferToBase64(data.authTag),
  });
}

/**
 * Utilidad: Deserializa datos cifrados desde JSON
 */
export function deserializeEncryptedData(json: string): EncryptedData {
  const parsed = JSON.parse(json);
  return {
    ciphertext: base64ToBuffer(parsed.ciphertext),
    iv: base64ToBuffer(parsed.iv),
    authTag: base64ToBuffer(parsed.authTag),
  };
}

// Exportar constantes útiles
export const CONSTANTS = {
  AES_ALGORITHM,
  AES_KEY_LENGTH,
  AES_IV_LENGTH,
  AUTH_TAG_LENGTH,
  RSA_ALGORITHM,
  RSA_MODULUS_LENGTH,
  HASH_ALGORITHM,
};
