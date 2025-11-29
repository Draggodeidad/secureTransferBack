import { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import logger from "../utils/logger.js";
import type {
  FilePackage,
  PackageMetadata,
  UploadResponse,
  DecryptRequest,
} from "../types/index.js";

// Simulación de base de datos en memoria
const packagesDB: Map<string, FilePackage> = new Map();
const metadataDB: Map<string, PackageMetadata> = new Map();

/**
 * Controlador para subir archivos
 */
export const uploadFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se proporcionó ningún archivo" });
      return;
    }

    const packageId = uuidv4();
    const uploaderId = req.body.userId || "anonymous";
    const publicKeyFingerprint = req.body.publicKeyFingerprint || "";

    // Crear paquete de archivo
    const filePackage: FilePackage = {
      packageId,
      filename: req.file.originalname,
      originalSize: req.file.size,
      encryptedSize: req.file.size, // En producción, esto sería el tamaño después del cifrado
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      encryptedPath: req.file.path,
      uploaderId,
      publicKeyFingerprint,
    };

    // Crear metadatos
    const metadata: PackageMetadata = {
      packageId,
      filename: req.file.originalname,
      originalSize: req.file.size,
      encryptedSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: filePackage.uploadedAt,
      expiresAt: filePackage.expiresAt,
      status: "active",
      uploaderId,
      uploaderPublicKeyFingerprint: publicKeyFingerprint,
      downloadCount: 0,
    };

    // Guardar en "base de datos"
    packagesDB.set(packageId, filePackage);
    metadataDB.set(packageId, metadata);

    logger.info(
      { packageId, filename: req.file.originalname },
      "Archivo subido exitosamente"
    );

    const response: UploadResponse = {
      packageId,
      filename: req.file.originalname,
      size: req.file.size,
      encryptedSize: req.file.size,
      expiresAt: filePackage.expiresAt,
      downloadUrl: `/download/${packageId}`,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error(error, "Error al subir archivo");
    res.status(500).json({ error: "Error al procesar el archivo" });
  }
};

/**
 * Controlador para descargar paquetes cifrados
 */
export const downloadPackage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const packageId = req.params["packageId"];

    if (!packageId) {
      res.status(400).json({ error: "Se requiere packageId" });
      return;
    }

    const filePackage = packagesDB.get(packageId);
    if (!filePackage) {
      res.status(404).json({ error: "Paquete no encontrado" });
      return;
    }

    // Verificar si el paquete ha expirado
    if (new Date() > filePackage.expiresAt) {
      res.status(410).json({ error: "El paquete ha expirado" });
      return;
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(filePackage.encryptedPath)) {
      res.status(404).json({ error: "Archivo no encontrado en el servidor" });
      return;
    }

    // Actualizar contador de descargas
    const metadata = metadataDB.get(packageId);
    if (metadata) {
      metadata.downloadCount++;
      metadata.status = "downloaded";
    }

    logger.info({ packageId }, "Descargando paquete");

    // Enviar archivo
    res.download(filePackage.encryptedPath, filePackage.filename, (err) => {
      if (err) {
        logger.error(err, "Error al enviar archivo");
      }
    });
  } catch (error) {
    logger.error(error, "Error al descargar paquete");
    res.status(500).json({ error: "Error al descargar el paquete" });
  }
};

/**
 * Controlador para descifrar paquetes
 */
export const decryptPackage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { packageId, privateKey }: DecryptRequest = req.body;

    if (!packageId || !privateKey) {
      res.status(400).json({
        error: "Se requiere packageId y privateKey",
      });
      return;
    }

    const filePackage = packagesDB.get(packageId);
    if (!filePackage) {
      res.status(404).json({ error: "Paquete no encontrado" });
      return;
    }

    // Verificar si el paquete ha expirado
    if (new Date() > filePackage.expiresAt) {
      res.status(410).json({ error: "El paquete ha expirado" });
      return;
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(filePackage.encryptedPath)) {
      res.status(404).json({ error: "Archivo no encontrado en el servidor" });
      return;
    }

    // En producción, aquí se descifraría el archivo con la llave privada
    // Por ahora, simplemente devolvemos el archivo
    logger.info({ packageId }, "Descifrando paquete");

    const fileData = fs.readFileSync(filePackage.encryptedPath);

    res.status(200).json({
      filename: filePackage.filename,
      mimeType: filePackage.mimeType,
      data: fileData.toString("base64"),
      message: "Archivo descifrado exitosamente",
    });
  } catch (error) {
    logger.error(error, "Error al descifrar paquete");
    res.status(500).json({ error: "Error al descifrar el paquete" });
  }
};

/**
 * Controlador para obtener metadatos de un paquete
 */
export const getPackageMetadata = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const packageId = req.params["packageId"];

    if (!packageId) {
      res.status(400).json({ error: "Se requiere packageId" });
      return;
    }

    const metadata = metadataDB.get(packageId);
    if (!metadata) {
      res.status(404).json({ error: "Paquete no encontrado" });
      return;
    }

    logger.info({ packageId }, "Obteniendo metadatos");
    res.status(200).json(metadata);
  } catch (error) {
    logger.error(error, "Error al obtener metadatos");
    res.status(500).json({ error: "Error al obtener metadatos" });
  }
};
