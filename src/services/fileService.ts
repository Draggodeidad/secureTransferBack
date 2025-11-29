import archiver from "archiver";
import logger from "../utils/logger.js";
import {
  generateSessionKey,
  aesEncrypt,
  aesDecrypt,
  hash,
  sign,
  verify,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  bufferToBase64,
  base64ToBuffer,
  type EncryptedData,
} from "./cryptoService.js";

/**
 * Interfaz para el paquete seguro
 */
export interface SecurePackage {
  encryptedFile: EncryptedData; // Archivo cifrado con AES-256-GCM
  encryptedSessionKey: Buffer; // Clave de sesión cifrada con RSA
  fileHash: string; // Hash SHA-256 del archivo original
  signature: Buffer; // Firma digital del hash
  uploaderPublicKey: string; // Clave pública del emisor
  metadata: {
    originalFilename: string;
    originalSize: number;
    mimeType: string;
    timestamp: Date;
  };
}

/**
 * Interfaz para metadatos del paquete en el ZIP
 */
interface PackageManifest {
  version: string;
  encryptedFile: {
    ciphertext: string; // base64
    iv: string; // base64
    authTag: string; // base64
  };
  encryptedSessionKey: string; // base64
  fileHash: string;
  signature: string; // base64
  uploaderPublicKey: string;
  metadata: {
    originalFilename: string;
    originalSize: number;
    mimeType: string;
    timestamp: string;
  };
}

/**
 * Cifra un archivo y lo empaqueta en un ZIP seguro
 * @param fileBuffer - Buffer del archivo a cifrar
 * @param originalFilename - Nombre original del archivo
 * @param mimeType - Tipo MIME del archivo
 * @param uploaderPrivateKey - Clave privada del emisor (para firmar)
 * @param uploaderPublicKey - Clave pública del emisor
 * @param recipientPublicKey - Clave pública del receptor (para cifrar la session key)
 * @returns Buffer del archivo ZIP con el paquete seguro
 */
export async function createSecurePackage(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
  uploaderPrivateKey: string,
  uploaderPublicKey: string,
  recipientPublicKey: string
): Promise<Buffer> {
  try {
    logger.info(
      { filename: originalFilename, size: fileBuffer.length },
      "Creando paquete seguro"
    );

    // 1. Generar hash del archivo original
    const fileHash = hash(fileBuffer);
    logger.info({ fileHash }, "Hash generado");

    // 2. Firmar hash con clave privada del emisor
    const signature = sign(fileHash, uploaderPrivateKey);
    logger.info("Firma digital generada");

    // 3. Generar clave de sesión AES
    const sessionKey = generateSessionKey();
    logger.info("Clave de sesión generada");

    // 4. Cifrar archivo con AES-256-GCM
    const encryptedFile = aesEncrypt(fileBuffer, sessionKey);
    logger.info(
      { encryptedSize: encryptedFile.ciphertext.length },
      "Archivo cifrado con AES-256-GCM"
    );

    // 5. Cifrar clave de sesión con clave pública del receptor
    const encryptedSessionKey = encryptWithPublicKey(
      sessionKey,
      recipientPublicKey
    );
    logger.info("Clave de sesión cifrada con RSA");

    // 6. Crear manifest del paquete
    const manifest: PackageManifest = {
      version: "1.0",
      encryptedFile: {
        ciphertext: bufferToBase64(encryptedFile.ciphertext),
        iv: bufferToBase64(encryptedFile.iv),
        authTag: bufferToBase64(encryptedFile.authTag),
      },
      encryptedSessionKey: bufferToBase64(encryptedSessionKey),
      fileHash,
      signature: bufferToBase64(signature),
      uploaderPublicKey,
      metadata: {
        originalFilename,
        originalSize: fileBuffer.length,
        mimeType,
        timestamp: new Date().toISOString(),
      },
    };

    // 7. Crear archivo ZIP con el paquete seguro
    const zipBuffer = await createZipPackage(manifest);
    logger.info({ zipSize: zipBuffer.length }, "Paquete ZIP creado");

    return zipBuffer;
  } catch (error) {
    logger.error({ error }, "Error al crear paquete seguro");
    throw error;
  }
}

/**
 * Crea un archivo ZIP con el manifest del paquete seguro
 */
async function createZipPackage(manifest: PackageManifest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Máxima compresión
    });

    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });

    archive.on("error", (err) => {
      reject(err);
    });

    // Agregar manifest como JSON
    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    });

    // Agregar README con instrucciones
    const readme = `
# Paquete Seguro - SecureTransfer

Este archivo ZIP contiene un archivo cifrado de forma segura.

## Contenido

- manifest.json: Metadatos del paquete cifrado

## Seguridad

- Cifrado: AES-256-GCM
- Intercambio de claves: RSA-2048 con OAEP
- Integridad: SHA-256 hash + firma digital RSA
- Versión del protocolo: ${manifest.version}

## Para descifrar

Use la API de SecureTransfer o la interfaz web proporcionando:
1. Su clave privada RSA
2. El packageId del archivo

## Metadatos

- Archivo original: ${manifest.metadata.originalFilename}
- Tamaño original: ${manifest.metadata.originalSize} bytes
- Tipo MIME: ${manifest.metadata.mimeType}
- Fecha de creación: ${manifest.metadata.timestamp}
- Hash SHA-256: ${manifest.fileHash}

⚠️ IMPORTANTE: Mantenga su clave privada segura. Sin ella, no podrá descifrar el archivo.
`;

    archive.append(readme, { name: "README.txt" });

    // Finalizar el archivo
    archive.finalize();
  });
}

/**
 * Desempaqueta y descifra un paquete seguro
 * @param _zipBuffer - Buffer del archivo ZIP
 * @param _recipientPrivateKey - Clave privada del receptor
 * @returns Buffer del archivo original descifrado
 */
export async function extractSecurePackage(
  _zipBuffer: Buffer,
  _recipientPrivateKey: string
): Promise<{
  fileBuffer: Buffer;
  metadata: PackageManifest["metadata"];
  verified: boolean;
}> {
  try {
    logger.info("Extrayendo paquete seguro");

    // Extraer manifest del ZIP (necesitarías una librería como 'unzipper')
    // Por ahora, asumiremos que el manifest se extrae correctamente
    // En producción, implementar la extracción completa del ZIP

    throw new Error("Función de extracción no implementada aún");
  } catch (error) {
    logger.error({ error }, "Error al extraer paquete seguro");
    throw error;
  }
}

/**
 * Descifra un archivo cifrado usando los datos del manifest
 * @param manifest - Manifest del paquete seguro
 * @param recipientPrivateKey - Clave privada del receptor
 * @returns Buffer del archivo original descifrado y resultado de verificación
 */
export async function decryptSecureFile(
  manifest: PackageManifest,
  recipientPrivateKey: string
): Promise<{ fileBuffer: Buffer; verified: boolean }> {
  try {
    logger.info("Descifrando archivo seguro");

    // 1. Descifrar clave de sesión con clave privada del receptor
    const encryptedSessionKey = base64ToBuffer(manifest.encryptedSessionKey);
    const sessionKey = decryptWithPrivateKey(
      encryptedSessionKey,
      recipientPrivateKey
    );
    logger.info("Clave de sesión descifrada");

    // 2. Descifrar archivo con AES-256-GCM
    const encryptedData: EncryptedData = {
      ciphertext: base64ToBuffer(manifest.encryptedFile.ciphertext),
      iv: base64ToBuffer(manifest.encryptedFile.iv),
      authTag: base64ToBuffer(manifest.encryptedFile.authTag),
    };

    const fileBuffer = aesDecrypt(
      encryptedData.ciphertext,
      sessionKey,
      encryptedData.iv,
      encryptedData.authTag
    );
    logger.info({ size: fileBuffer.length }, "Archivo descifrado");

    // 3. Verificar integridad del archivo
    const fileHash = hash(fileBuffer);
    const hashMatch = fileHash === manifest.fileHash;
    logger.info({ hashMatch }, "Verificación de integridad");

    // 4. Verificar firma digital
    const signature = base64ToBuffer(manifest.signature);
    const signatureValid = verify(
      signature,
      manifest.fileHash,
      manifest.uploaderPublicKey
    );
    logger.info({ signatureValid }, "Verificación de firma");

    const verified = hashMatch && signatureValid;

    return {
      fileBuffer,
      verified,
    };
  } catch (error) {
    logger.error({ error }, "Error al descifrar archivo seguro");
    throw error;
  }
}

/**
 * Calcula el fingerprint (huella digital) de una clave pública
 */
export function calculateKeyFingerprint(publicKey: string): string {
  return hash(Buffer.from(publicKey, "utf-8")).substring(0, 16);
}
