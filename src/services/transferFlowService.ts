/**
 * Servicio de flujo de transferencia seguro
 * Implementa el flujo completo de transferencia con funciones reusables
 *
 * FASE 4: Flujo de Transferencia Seguro
 */

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
 * Interfaz para el resultado del proceso de upload (emisor A)
 */
export interface UploadFlowResult {
  encryptedFile: EncryptedData;
  sessionKey: Buffer;
  encryptedSessionKey: Buffer;
  fileHash: string;
  signature: Buffer;
  metadata: {
    originalFilename: string;
    originalSize: number;
    mimeType: string;
    timestamp: Date;
  };
}

/**
 * Interfaz para el resultado del proceso de download/descifrado (receptor B)
 */
export interface DownloadFlowResult {
  fileBuffer: Buffer;
  metadata: {
    originalFilename: string;
    originalSize: number;
    mimeType: string;
    timestamp: Date;
  };
  verified: boolean;
  verificationDetails: {
    hashValid: boolean;
    signatureValid: boolean;
  };
}

/**
 * Interfaz para los datos del manifest
 */
export interface ManifestData {
  version?: string;
  encryptedFile: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  encryptedSessionKey: string;
  fileHash: string;
  signature: string;
  uploaderPublicKey: string;
  metadata: {
    originalFilename: string;
    originalSize: number;
    mimeType: string;
    timestamp: string;
  };
}

// ============================================================================
// PASO 1: PROCESO DE UPLOAD (EMISOR A)
// ============================================================================

/**
 * Paso 1.1: Generar sessionKey AES-256
 * @returns Buffer con la clave de sesión de 32 bytes
 */
export function generateAESSessionKey(): Buffer {
  logger.info("Generando clave de sesión AES-256");
  const sessionKey = generateSessionKey();
  logger.info({ keyLength: sessionKey.length }, "Clave de sesión generada");
  return sessionKey;
}

/**
 * Paso 1.2: Cifrar archivo con AES-256-GCM
 * @param fileBuffer - Buffer del archivo a cifrar
 * @param sessionKey - Clave de sesión AES de 32 bytes
 * @returns Objeto con archivo cifrado, IV y authTag
 */
export function encryptFile(
  fileBuffer: Buffer,
  sessionKey: Buffer
): EncryptedData {
  logger.info(
    { fileSize: fileBuffer.length },
    "Cifrando archivo con AES-256-GCM"
  );
  const encryptedData = aesEncrypt(fileBuffer, sessionKey);
  logger.info(
    { encryptedSize: encryptedData.ciphertext.length },
    "Archivo cifrado exitosamente"
  );
  return encryptedData;
}

/**
 * Paso 1.3: Calcular hash SHA-256 del archivo original
 * @param fileBuffer - Buffer del archivo original
 * @returns Hash SHA-256 en formato hexadecimal
 */
export function calculateFileHash(fileBuffer: Buffer): string {
  logger.info({ fileSize: fileBuffer.length }, "Calculando hash SHA-256");
  const fileHash = hash(fileBuffer);
  logger.info({ fileHash }, "Hash calculado");
  return fileHash;
}

/**
 * Paso 1.4: Firmar hash con llave privada del emisor
 * @param fileHash - Hash SHA-256 del archivo
 * @param privateKey - Clave privada del emisor en formato PEM
 * @returns Buffer con la firma digital
 */
export function signFileHash(fileHash: string, privateKey: string): Buffer {
  logger.info("Firmando hash con clave privada");
  const signature = sign(fileHash, privateKey);
  logger.info({ signatureLength: signature.length }, "Firma digital generada");
  return signature;
}

/**
 * Paso 1.5: Cifrar sessionKey con llave pública del receptor
 * @param sessionKey - Clave de sesión AES
 * @param recipientPublicKey - Clave pública del receptor en formato PEM
 * @returns Buffer con la clave de sesión cifrada
 */
export function encryptSessionKey(
  sessionKey: Buffer,
  recipientPublicKey: string
): Buffer {
  logger.info("Cifrando clave de sesión con RSA-2048");
  const encryptedSessionKey = encryptWithPublicKey(
    sessionKey,
    recipientPublicKey
  );
  logger.info(
    { encryptedLength: encryptedSessionKey.length },
    "Clave de sesión cifrada"
  );
  return encryptedSessionKey;
}

/**
 * Paso 1.6: Empaquetar todos los datos en un objeto para ZIP
 * @param encryptedFile - Datos del archivo cifrado
 * @param encryptedSessionKey - Clave de sesión cifrada
 * @param fileHash - Hash del archivo original
 * @param signature - Firma digital del hash
 * @param uploaderPublicKey - Clave pública del emisor
 * @param filename - Nombre del archivo original
 * @param originalSize - Tamaño del archivo original
 * @param mimeType - Tipo MIME del archivo
 * @returns Objeto con todos los datos del paquete
 */
export function packageSecureData(
  encryptedFile: EncryptedData,
  encryptedSessionKey: Buffer,
  fileHash: string,
  signature: Buffer,
  uploaderPublicKey: string,
  filename: string,
  originalSize: number,
  mimeType: string
): ManifestData {
  logger.info("Empaquetando datos seguros");

  const manifest: ManifestData = {
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
      originalFilename: filename,
      originalSize,
      mimeType,
      timestamp: new Date().toISOString(),
    },
  };

  logger.info("Datos empaquetados exitosamente");
  return manifest;
}

/**
 * FLUJO COMPLETO DE UPLOAD (EMISOR A)
 * Ejecuta todos los pasos del proceso de cifrado y empaquetado
 *
 * @param fileBuffer - Buffer del archivo a cifrar
 * @param filename - Nombre del archivo original
 * @param mimeType - Tipo MIME del archivo
 * @param uploaderPrivateKey - Clave privada del emisor (para firmar)
 * @param uploaderPublicKey - Clave pública del emisor
 * @param recipientPublicKey - Clave pública del receptor
 * @returns Objeto con todos los datos del flujo de upload
 */
export function executeUploadFlow(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  uploaderPrivateKey: string,
  _uploaderPublicKey: string,
  recipientPublicKey: string
): UploadFlowResult {
  logger.info(
    { filename, size: fileBuffer.length },
    "🚀 Iniciando flujo de upload completo"
  );

  // Paso 1.1: Generar sessionKey AES
  const sessionKey = generateAESSessionKey();

  // Paso 1.2: Cifrar archivo
  const encryptedFile = encryptFile(fileBuffer, sessionKey);

  // Paso 1.3: Hash del archivo original
  const fileHash = calculateFileHash(fileBuffer);

  // Paso 1.4: Firma del hash
  const signature = signFileHash(fileHash, uploaderPrivateKey);

  // Paso 1.5: Cifrar sessionKey
  const encryptedSessionKey = encryptSessionKey(sessionKey, recipientPublicKey);

  logger.info("✅ Flujo de upload completado exitosamente");

  return {
    encryptedFile,
    sessionKey,
    encryptedSessionKey,
    fileHash,
    signature,
    metadata: {
      originalFilename: filename,
      originalSize: fileBuffer.length,
      mimeType,
      timestamp: new Date(),
    },
  };
}

// ============================================================================
// PASO 2: PROCESO DE DOWNLOAD/DESCIFRADO (RECEPTOR B)
// ============================================================================

/**
 * Paso 2.1: Descifrar sessionKey con llave privada del receptor
 * @param encryptedSessionKey - Clave de sesión cifrada
 * @param recipientPrivateKey - Clave privada del receptor en formato PEM
 * @returns Buffer con la clave de sesión descifrada
 */
export function decryptSessionKey(
  encryptedSessionKey: Buffer,
  recipientPrivateKey: string
): Buffer {
  logger.info("Descifrando clave de sesión con RSA-2048");
  const sessionKey = decryptWithPrivateKey(
    encryptedSessionKey,
    recipientPrivateKey
  );
  logger.info({ keyLength: sessionKey.length }, "Clave de sesión descifrada");
  return sessionKey;
}

/**
 * Paso 2.2: Descifrar archivo con AES sessionKey + IV
 * @param encryptedData - Datos del archivo cifrado
 * @param sessionKey - Clave de sesión AES descifrada
 * @returns Buffer con el archivo descifrado
 */
export function decryptFile(
  encryptedData: EncryptedData,
  sessionKey: Buffer
): Buffer {
  logger.info("Descifrando archivo con AES-256-GCM");
  const fileBuffer = aesDecrypt(
    encryptedData.ciphertext,
    sessionKey,
    encryptedData.iv,
    encryptedData.authTag
  );
  logger.info(
    { fileSize: fileBuffer.length },
    "Archivo descifrado exitosamente"
  );
  return fileBuffer;
}

/**
 * Paso 2.3: Calcular hash del archivo descifrado y verificar
 * @param fileBuffer - Buffer del archivo descifrado
 * @param expectedHash - Hash esperado del archivo
 * @returns true si el hash coincide, false en caso contrario
 */
export function verifyFileIntegrity(
  fileBuffer: Buffer,
  expectedHash: string
): boolean {
  logger.info("Verificando integridad del archivo");
  const calculatedHash = hash(fileBuffer);
  const isValid = calculatedHash === expectedHash;
  logger.info(
    { calculatedHash, expectedHash, isValid },
    "Verificación de integridad"
  );
  return isValid;
}

/**
 * Paso 2.4: Verificar firma con llave pública del emisor
 * @param signature - Firma digital a verificar
 * @param fileHash - Hash del archivo
 * @param uploaderPublicKey - Clave pública del emisor en formato PEM
 * @returns true si la firma es válida, false en caso contrario
 */
export function verifyFileSignature(
  signature: Buffer,
  fileHash: string,
  uploaderPublicKey: string
): boolean {
  logger.info("Verificando firma digital");
  const isValid = verify(signature, fileHash, uploaderPublicKey);
  logger.info({ isValid }, "Verificación de firma");
  return isValid;
}

/**
 * FLUJO COMPLETO DE DOWNLOAD/DESCIFRADO (RECEPTOR B)
 * Ejecuta todos los pasos del proceso de descifrado y verificación
 *
 * @param manifest - Datos del manifest del paquete
 * @param recipientPrivateKey - Clave privada del receptor
 * @returns Objeto con el archivo descifrado y resultado de verificaciones
 */
export function executeDownloadFlow(
  manifest: ManifestData,
  recipientPrivateKey: string
): DownloadFlowResult {
  logger.info("🚀 Iniciando flujo de download/descifrado completo");

  // Paso 2.1: Descifrar sessionKey
  const encryptedSessionKey = base64ToBuffer(manifest.encryptedSessionKey);
  const sessionKey = decryptSessionKey(
    encryptedSessionKey,
    recipientPrivateKey
  );

  // Paso 2.2: Descifrar archivo
  const encryptedData: EncryptedData = {
    ciphertext: base64ToBuffer(manifest.encryptedFile.ciphertext),
    iv: base64ToBuffer(manifest.encryptedFile.iv),
    authTag: base64ToBuffer(manifest.encryptedFile.authTag),
  };
  const fileBuffer = decryptFile(encryptedData, sessionKey);

  // Paso 2.3: Verificar hash
  const hashValid = verifyFileIntegrity(fileBuffer, manifest.fileHash);

  // Paso 2.4: Verificar firma
  const signature = base64ToBuffer(manifest.signature);
  const signatureValid = verifyFileSignature(
    signature,
    manifest.fileHash,
    manifest.uploaderPublicKey
  );

  const verified = hashValid && signatureValid;

  logger.info(
    { hashValid, signatureValid, verified },
    "✅ Flujo de download completado"
  );

  return {
    fileBuffer,
    metadata: {
      originalFilename: manifest.metadata.originalFilename,
      originalSize: manifest.metadata.originalSize,
      mimeType: manifest.metadata.mimeType,
      timestamp: new Date(manifest.metadata.timestamp),
    },
    verified,
    verificationDetails: {
      hashValid,
      signatureValid,
    },
  };
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Convierte un manifest a formato serializable
 */
export function serializeManifest(manifest: ManifestData): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Parsea un manifest desde formato JSON
 */
export function parseManifest(manifestJson: string): ManifestData {
  return JSON.parse(manifestJson);
}

/**
 * Valida que un manifest tenga todos los campos requeridos
 */
export function validateManifest(manifest: ManifestData): boolean {
  const requiredFields = [
    "encryptedFile",
    "encryptedSessionKey",
    "fileHash",
    "signature",
    "uploaderPublicKey",
    "metadata",
  ];

  for (const field of requiredFields) {
    if (!(manifest as any)[field]) {
      logger.error({ field }, "Campo requerido faltante en manifest");
      return false;
    }
  }

  // Validar encryptedFile
  const encryptedFileFields = ["ciphertext", "iv", "authTag"];
  for (const field of encryptedFileFields) {
    if (!(manifest.encryptedFile as any)[field]) {
      logger.error({ field }, "Campo requerido faltante en encryptedFile");
      return false;
    }
  }

  return true;
}
