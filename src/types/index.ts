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
  encryptedPath: string;
  signature?: string;
  uploaderId: string;
  publicKeyFingerprint: string;
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
  uploaderPublicKeyFingerprint: string;
  signature?: string;
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
}

export interface DecryptRequest {
  packageId: string;
  privateKey: string;
}

export interface DecryptResponse {
  filename: string;
  data: Buffer;
  mimeType: string;
}
