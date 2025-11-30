import { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";
import logger from "../utils/logger.js";
import {
  uploadFileToSupabase,
  downloadFileFromSupabase,
} from "../services/supabaseService.js";
import {
  createSecurePackage,
  decryptSecureFile,
  calculateKeyFingerprint,
} from "../services/fileService.js";
import type {
  FilePackage,
  PackageMetadata,
  UploadResponse,
  DecryptRequest,
  UploadRequest,
} from "../types/index.js";
import { hash } from "../services/cryptoService.js";
import {
  logDownload,
  updateDownloadCount,
  updateUserStats,
  notifyFileDownloaded,
} from "../services/notificationService.js";

// Simulación de base de datos en memoria
const packagesDB: Map<string, FilePackage> = new Map();
const metadataDB: Map<string, PackageMetadata> = new Map();

/**
 * Controlador para subir archivos con cifrado
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

    // Obtener configuración desde variables de entorno
    const uploaderPrivateKey = process.env["SERVER_PRIVATE_KEY"];
    const uploaderPublicKey = process.env["SERVER_PUBLIC_KEY"];

    if (!uploaderPrivateKey || !uploaderPublicKey) {
      logger.error(
        "Claves del servidor no configuradas en variables de entorno"
      );
      res.status(500).json({
        error:
          "Servidor no configurado correctamente. Contacte al administrador.",
      });
      return;
    }

    // Obtener clave pública del receptor desde el body
    let { userId, recipientPublicKey }: Partial<UploadRequest> = req.body;

    if (!recipientPublicKey) {
      res.status(400).json({
        error: "Se requiere recipientPublicKey (clave pública del receptor)",
      });
      return;
    }

    // Normalizar la clave pública: convertir \n literales a saltos de línea reales
    // Esto soluciona el problema cuando se envía desde Postman con \n como texto
    recipientPublicKey = recipientPublicKey
      .replace(/\\n/g, "\n") // Reemplazar \n literales con saltos reales
      .replace(/\\r/g, "") // Eliminar \r si existe
      .trim(); // Limpiar espacios

    // Validar formato básico de la clave PEM
    if (
      !recipientPublicKey.includes("-----BEGIN") ||
      !recipientPublicKey.includes("-----END")
    ) {
      logger.error({ recipientPublicKey }, "Formato de clave pública inválido");
      res.status(400).json({
        error:
          "Formato de clave pública inválido. Debe ser una clave RSA en formato PEM.",
      });
      return;
    }

    logger.info("Clave pública del receptor normalizada correctamente");

    const packageId = uuidv4();
    const uploaderId = userId || "anonymous";

    logger.info(
      { packageId, filename: req.file.originalname, size: req.file.size },
      "Iniciando proceso de cifrado y empaquetado"
    );

    // 1. Crear paquete seguro (cifrado + firma + empaquetado en ZIP)
    const securePackageBuffer = await createSecurePackage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      uploaderPrivateKey,
      uploaderPublicKey,
      recipientPublicKey
    );

    // 2. Generar hash del archivo original (para metadatos)
    const fileHash = hash(req.file.buffer);

    // 3. Subir paquete ZIP a Supabase
    const timestamp = Date.now();
    const supabaseFileName = `${packageId}-${timestamp}.zip`;

    const { path: supabasePath } = await uploadFileToSupabase(
      supabaseFileName,
      securePackageBuffer,
      "application/zip" // MIME type del paquete ZIP
    );

    logger.info(
      { packageId, supabasePath, zipSize: securePackageBuffer.length },
      "Paquete seguro subido a Supabase"
    );

    // 4. Calcular fingerprint de la clave pública
    const publicKeyFingerprint = calculateKeyFingerprint(uploaderPublicKey);

    // 5. Crear registro del paquete
    const filePackage: FilePackage = {
      packageId,
      filename: req.file.originalname,
      originalSize: req.file.size,
      encryptedSize: securePackageBuffer.length,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      encryptedPath: supabasePath,
      fileHash,
      signature: "", // La firma está dentro del ZIP manifest
      uploaderId,
      uploaderPublicKey,
      publicKeyFingerprint,
    };

    // 6. Crear metadatos
    const metadata: PackageMetadata = {
      packageId,
      filename: req.file.originalname,
      originalSize: req.file.size,
      encryptedSize: securePackageBuffer.length,
      mimeType: req.file.mimetype,
      uploadedAt: filePackage.uploadedAt,
      expiresAt: filePackage.expiresAt,
      status: "active",
      uploaderId,
      uploaderPublicKey,
      uploaderPublicKeyFingerprint: publicKeyFingerprint,
      fileHash,
      signature: "",
      downloadCount: 0,
    };

    // 7. Guardar en "base de datos" (memoria + Supabase)
    packagesDB.set(packageId, filePackage);
    metadataDB.set(packageId, metadata);

    // 8. Guardar en Supabase (tabla files)
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseKey =
      process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
      process.env["SUPABASE_ANON_KEY"];

    if (supabaseUrl && supabaseKey && uploaderId !== "anonymous") {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Insertar en tabla files
        const { error: fileError } = await supabase.from("files").insert({
          package_id: packageId,
          uploader_id: uploaderId,
          original_filename: req.file.originalname,
          original_size: req.file.size,
          mime_type: req.file.mimetype,
          file_hash: fileHash,
          encrypted_size: securePackageBuffer.length,
          encrypted_path: supabasePath,
          master_encrypted_session_key: "dummy_key", // TODO: Implementar cifrado real
          signature: publicKeyFingerprint,
          max_downloads: null,
          expires_at: filePackage.expiresAt.toISOString(),
          allow_reshare: false,
          require_auth: true,
          status: "active",
        });

        if (fileError) {
          logger.error({ fileError }, "Error al insertar archivo en Supabase");
        } else {
          logger.info(
            { packageId },
            "Archivo insertado en tabla files de Supabase"
          );

          // Actualizar estadísticas del usuario
          const { updateUserStats } =
            await import("../services/notificationService.js");
          updateUserStats(uploaderId, "upload", req.file.size).catch((err) =>
            logger.error({ err }, "Error al actualizar estadísticas de usuario")
          );
        }
      } catch (supabaseError) {
        logger.error({ supabaseError }, "Error al guardar en Supabase");
      }
    }

    logger.info(
      {
        packageId,
        filename: req.file.originalname,
        originalSize: req.file.size,
        encryptedSize: securePackageBuffer.length,
        fileHash,
      },
      "Archivo procesado y almacenado exitosamente"
    );

    const response: UploadResponse = {
      packageId,
      filename: req.file.originalname,
      size: req.file.size,
      encryptedSize: securePackageBuffer.length,
      expiresAt: filePackage.expiresAt,
      downloadUrl: `/download/${packageId}`,
      fileHash,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error(error, "Error al procesar archivo");
    res.status(500).json({ error: "Error al procesar el archivo" });
  }
};

/**
 * Controlador para descargar paquetes cifrados (ZIP)
 */
export const downloadPackage = async (
  req: Request,
  res: Response
): Promise<void> => {
  const packageId = req.params["packageId"];

  try {
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

    // Obtener información del usuario desde el header de autorización (opcional)
    const authHeader = req.headers.authorization;
    let userId = "anonymous";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey =
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
          process.env["SUPABASE_ANON_KEY"];

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const token = authHeader.substring(7);
          const { data: userData } = await supabase.auth.getUser(token);
          if (userData?.user) {
            userId = userData.user.id;
          }
        }
      } catch (authError) {
        // Si falla la autenticación, continuar como anónimo
        logger.warn(
          { authError },
          "No se pudo autenticar usuario, continuando como anónimo"
        );
      }
    }

    // Descargar paquete ZIP desde Supabase
    const fileBlob = await downloadFileFromSupabase(filePackage.encryptedPath);

    // Actualizar contador de descargas
    const metadata = metadataDB.get(packageId);
    if (metadata) {
      metadata.downloadCount++;
      if (metadata.downloadCount === 1) {
        metadata.status = "downloaded";
      }
    }

    logger.info(
      { packageId, path: filePackage.encryptedPath, userId },
      "Descargando paquete seguro desde Supabase"
    );

    // Convertir Blob a Buffer
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Marcar como exitoso antes de enviar
    downloadSuccess = true;

    // Registrar descarga en la base de datos (async, no bloquea la respuesta)
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    logDownload(
      packageId,
      userId,
      "zip",
      true,
      undefined,
      ipAddress,
      userAgent
    ).catch((err) =>
      logger.error({ err }, "Error al registrar log de descarga")
    );

    // Actualizar estadísticas (async)
    if (userId !== "anonymous") {
      updateUserStats(userId, "download").catch((err) =>
        logger.error({ err }, "Error al actualizar estadísticas")
      );
      updateDownloadCount(packageId, userId).catch((err) =>
        logger.error({ err }, "Error al actualizar contador de descargas")
      );
    }

    // Configurar headers para descarga del ZIP
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${packageId}.zip"`
    );
    res.setHeader("Content-Length", buffer.length);

    // Enviar archivo ZIP
    res.send(buffer);
  } catch (error) {
    logger.error(error, "Error al descargar paquete");

    // Registrar descarga fallida
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const userId = "anonymous"; // Ya que no tenemos el userId en el scope del catch

    logDownload(
      packageId || "unknown",
      userId,
      "zip",
      false,
      error instanceof Error ? error.message : "Error desconocido",
      ipAddress,
      userAgent
    ).catch((err) =>
      logger.error({ err }, "Error al registrar log de descarga fallida")
    );

    res.status(500).json({ error: "Error al descargar el paquete" });
  }
};

/**
 * Controlador para descifrar paquetes
 * El cliente envía el manifest extraído del ZIP y su clave privada
 */
export const decryptPackage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let { packageId, privateKey, manifest }: DecryptRequest & any = req.body;

    if (!packageId || !privateKey || !manifest) {
      res.status(400).json({
        error: "Se requiere packageId, privateKey y manifest",
      });
      return;
    }

    // Normalizar la clave privada: convertir \n literales a saltos de línea reales
    privateKey = privateKey.replace(/\\n/g, "\n").replace(/\\r/g, "").trim();

    // Normalizar la clave pública del uploader en el manifest
    if (manifest.uploaderPublicKey) {
      manifest.uploaderPublicKey = manifest.uploaderPublicKey
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .trim();
    }

    // Validar formato de la clave privada
    if (
      !privateKey.includes("-----BEGIN") ||
      !privateKey.includes("-----END")
    ) {
      logger.error("Formato de clave privada inválido");
      res.status(400).json({
        error:
          "Formato de clave privada inválido. Debe ser una clave RSA en formato PEM.",
      });
      return;
    }

    logger.info("Clave privada normalizada correctamente");

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

    logger.info({ packageId }, "Iniciando descifrado de paquete");

    // Descifrar el archivo usando el manifest
    const { fileBuffer, verified } = await decryptSecureFile(
      manifest,
      privateKey
    );

    if (!verified) {
      logger.warn({ packageId }, "⚠️ Advertencia: Verificación de firma falló");
    }

    logger.info(
      { packageId, size: fileBuffer.length, verified },
      "Archivo descifrado exitosamente"
    );

    res.status(200).json({
      filename: filePackage.filename,
      mimeType: filePackage.mimeType,
      data: fileBuffer.toString("base64"),
      verified,
      message: verified
        ? "Archivo descifrado y verificado exitosamente"
        : "Archivo descifrado, pero la verificación de firma falló",
    });
  } catch (error) {
    logger.error(error, "Error al descifrar paquete");
    res.status(500).json({
      error: "Error al descifrar el paquete",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
};

/**
 * Controlador para descargar archivo descifrado directamente
 * El receptor envía su clave privada y recibe el archivo original
 */
export const downloadDecryptedFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const packageId = req.params["packageId"];
  let userId = "anonymous";

  try {
    let { privateKey } = req.body;

    if (!packageId) {
      res.status(400).json({ error: "Se requiere packageId" });
      return;
    }

    if (!privateKey) {
      res.status(400).json({
        error: "Se requiere privateKey (clave privada del receptor)",
      });
      return;
    }

    // Normalizar la clave privada
    privateKey = privateKey.replace(/\\n/g, "\n").replace(/\\r/g, "").trim();

    // Validar formato de la clave privada
    if (
      !privateKey.includes("-----BEGIN") ||
      !privateKey.includes("-----END")
    ) {
      res.status(400).json({
        error:
          "Formato de clave privada inválido. Debe ser una clave RSA en formato PEM.",
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

    // Obtener información del usuario desde el header de autorización (opcional)
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey =
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
          process.env["SUPABASE_ANON_KEY"];

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const token = authHeader.substring(7);
          const { data: userData } = await supabase.auth.getUser(token);
          if (userData?.user) {
            userId = userData.user.id;
          }
        }
      } catch (authError) {
        logger.warn({ authError }, "No se pudo autenticar usuario");
      }
    }

    logger.info(
      { packageId, filename: filePackage.filename, userId },
      "Descargando y descifrando archivo automáticamente"
    );

    // 1. Descargar paquete ZIP desde Supabase
    const fileBlob = await downloadFileFromSupabase(filePackage.encryptedPath);
    const arrayBuffer = await fileBlob.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // 2. Extraer manifest del ZIP
    const zip = new AdmZip(zipBuffer);
    const manifestEntry = zip.getEntry("manifest.json");

    if (!manifestEntry) {
      res.status(500).json({
        error: "Manifest no encontrado en el paquete",
      });
      return;
    }

    const manifestContent = manifestEntry.getData().toString("utf8");
    const manifest = JSON.parse(manifestContent);

    // Normalizar clave pública del uploader en el manifest
    if (manifest.uploaderPublicKey) {
      manifest.uploaderPublicKey = manifest.uploaderPublicKey
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .trim();
    }

    // 3. Descifrar el archivo
    const { fileBuffer, verified } = await decryptSecureFile(
      manifest,
      privateKey
    );

    if (!verified) {
      logger.warn(
        { packageId },
        "⚠️ Advertencia: Verificación de firma o integridad falló"
      );
    }

    // 4. Actualizar contador de descargas
    const metadata = metadataDB.get(packageId);
    if (metadata) {
      metadata.downloadCount++;
      if (metadata.downloadCount === 1) {
        metadata.status = "downloaded";
      }
    }

    // 5. Registrar descarga en la base de datos (async)
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    logDownload(
      packageId,
      userId,
      "decrypted",
      true,
      undefined,
      ipAddress,
      userAgent
    ).catch((err) =>
      logger.error({ err }, "Error al registrar log de descarga")
    );

    // 6. Actualizar estadísticas (async)
    if (userId !== "anonymous") {
      updateUserStats(userId, "download").catch((err) =>
        logger.error({ err }, "Error al actualizar estadísticas")
      );
      updateDownloadCount(packageId, userId).catch((err) =>
        logger.error({ err }, "Error al actualizar contador de descargas")
      );

      // 7. Notificar al uploader que alguien descargó su archivo (async)
      notifyFileDownloaded(
        packageId,
        filePackage.uploaderId,
        userId,
        filePackage.filename
      ).catch((err) => logger.error({ err }, "Error al notificar descarga"));
    }

    logger.info(
      { packageId, size: fileBuffer.length, verified, userId },
      "Archivo descifrado y enviado exitosamente"
    );

    // 8. Enviar archivo original descifrado
    res.setHeader("Content-Type", filePackage.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filePackage.filename}"`
    );
    res.setHeader("Content-Length", fileBuffer.length);
    res.setHeader("X-File-Verified", verified.toString());

    res.send(fileBuffer);
  } catch (error) {
    logger.error(error, "Error al descargar archivo descifrado");

    // Registrar descarga fallida
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    logDownload(
      packageId || "unknown",
      userId,
      "decrypted",
      false,
      error instanceof Error ? error.message : "Error desconocido",
      ipAddress,
      userAgent
    ).catch((err) =>
      logger.error({ err }, "Error al registrar log de descarga fallida")
    );

    res.status(500).json({
      error: "Error al descifrar y descargar el archivo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
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

/**
 * Controlador para obtener el manifest de un paquete
 * Descarga el ZIP desde Supabase y extrae solo el manifest.json
 */
export const getPackageManifest = async (
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

    logger.info({ packageId }, "Descargando paquete ZIP desde Supabase");

    // Descargar el ZIP desde Supabase
    const fileBlob = await downloadFileFromSupabase(filePackage.encryptedPath);
    const arrayBuffer = await fileBlob.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    logger.info(
      { packageId, zipSize: zipBuffer.length },
      "Extrayendo manifest.json del ZIP"
    );

    // Extraer manifest.json del ZIP
    const zip = new AdmZip(zipBuffer);
    const manifestEntry = zip.getEntry("manifest.json");

    if (!manifestEntry) {
      logger.error(
        { packageId },
        "manifest.json no encontrado en el paquete ZIP"
      );
      res.status(500).json({
        error: "Manifest no encontrado en el paquete",
        message:
          "El archivo manifest.json no existe en el paquete ZIP. Esto puede indicar un problema durante la creación del paquete.",
      });
      return;
    }

    // Leer el contenido del manifest
    const manifestContent = manifestEntry.getData().toString("utf8");
    const manifest = JSON.parse(manifestContent);

    logger.info(
      { packageId, manifestSize: manifestContent.length },
      "Manifest extraído exitosamente"
    );

    // Retornar el manifest
    res.status(200).json({
      packageId,
      manifest,
      metadata: {
        extractedAt: new Date().toISOString(),
        manifestSize: manifestContent.length,
        zipSize: zipBuffer.length,
      },
    });
  } catch (error) {
    logger.error(error, "Error al obtener manifest");
    res.status(500).json({
      error: "Error al extraer manifest del paquete",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
};
