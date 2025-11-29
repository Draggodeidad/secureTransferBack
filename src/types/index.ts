/**
 * Tipos e interfaces para el sistema de transferencia segura
 */

export interface FilePackage {
  packageId: string;
  filename: string;
  originalSize: number;
  encryptedSize: number;
  mimeType: string;
  uploadedAt: Date;
  expiresAt: Date;
  encryptedPath: string; // Ruta del archivo ZIP en Supabase
  fileHash: string; // Hash SHA-256 del archivo original
  signature: string; // Firma digital del hash (base64)
  uploaderId: string;
  uploaderPublicKey: string; // Clave pública del emisor (PEM)
  publicKeyFingerprint: string; // Fingerprint de la clave pública
}

export interface PackageMetadata {
  packageId: string;
  filename: string;
  originalSize: number;
  encryptedSize: number;
  mimeType: string;
  uploadedAt: Date;
  expiresAt: Date;
  status: "active" | "expired" | "downloaded" | "deleted";
  uploaderId: string;
  uploaderPublicKey: string;
  uploaderPublicKeyFingerprint: string;
  fileHash: string;
  signature: string;
  downloadCount: number;
}

export interface PublicKey {
  keyId: string;
  userId: string;
  publicKey: string;
  fingerprint: string;
  algorithm: string;
  createdAt: Date;
  isActive: boolean;
}

export interface UploadResponse {
  packageId: string;
  filename: string;
  size: number;
  encryptedSize: number;
  expiresAt: Date;
  downloadUrl: string;
  fileHash: string;
}

export interface UploadRequest {
  userId?: string;
  recipientPublicKey: string; // Solo necesita la clave pública del receptor
  // Las claves del servidor se leen desde variables de entorno
}

export interface DecryptRequest {
  packageId: string;
  privateKey: string; // Clave privada del receptor (PEM)
}

export interface DecryptResponse {
  filename: string;
  data: Buffer;
  mimeType: string;
}
