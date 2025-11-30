import { createClient } from "@supabase/supabase-js";
import logger from "../utils/logger.js";

// Cliente de Supabase
function getSupabase() {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_ANON_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL y SUPABASE_ANON_KEY son requeridos");
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Registra una descarga en el log de auditoría
 */
export async function logDownload(
  packageId: string,
  userId: string,
  downloadType: "zip" | "decrypted",
  success: boolean,
  errorMessage?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const supabase = getSupabase();

    const { error } = await supabase.from("download_logs").insert({
      package_id: packageId,
      downloaded_by: userId,
      download_type: downloadType,
      success,
      error_message: errorMessage || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      downloaded_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({ error, packageId, userId }, "Error al registrar descarga");
    } else {
      logger.info(
        { packageId, userId, downloadType, success },
        "Descarga registrada en download_logs"
      );
    }
  } catch (error) {
    logger.error({ error }, "Error al registrar descarga en la base de datos");
  }
}

/**
 * Actualiza el contador de descargas en file_permissions
 */
export async function updateDownloadCount(
  packageId: string,
  userId: string
): Promise<void> {
  try {
    const supabase = getSupabase();

    // Obtener el permiso actual
    const { data: permission } = await supabase
      .from("file_permissions")
      .select("downloads_count, max_downloads, first_accessed_at")
      .eq("package_id", packageId)
      .eq("recipient_id", userId)
      .single();

    if (permission) {
      // Incrementar contador
      const newCount = (permission.downloads_count || 0) + 1;
      const updates: any = {
        downloads_count: newCount,
        last_accessed_at: new Date().toISOString(),
      };

      // Si es la primera descarga, registrar fecha
      if (!permission.first_accessed_at) {
        updates.first_accessed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("file_permissions")
        .update(updates)
        .eq("package_id", packageId)
        .eq("recipient_id", userId);

      if (error) {
        logger.error(
          { error, packageId, userId },
          "Error al actualizar contador de descargas"
        );
      } else {
        logger.info(
          { packageId, userId, newCount },
          "Contador de descargas actualizado"
        );
      }
    }
  } catch (error) {
    logger.error(
      { error },
      "Error al actualizar contador de descargas en file_permissions"
    );
  }
}

/**
 * Actualiza las estadísticas del usuario en user_profiles
 */
export async function updateUserStats(
  userId: string,
  type: "upload" | "download",
  sizeBytes?: number
): Promise<void> {
  try {
    const supabase = getSupabase();

    // Obtener estadísticas actuales
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("total_uploads, total_downloads, storage_used_bytes")
      .eq("id", userId)
      .single();

    if (profile) {
      const updates: any = {};

      if (type === "upload") {
        updates.total_uploads = (profile.total_uploads || 0) + 1;
        if (sizeBytes) {
          updates.storage_used_bytes =
            (profile.storage_used_bytes || 0) + sizeBytes;
        }
      } else if (type === "download") {
        updates.total_downloads = (profile.total_downloads || 0) + 1;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", userId);

      if (error) {
        logger.error({ error, userId }, "Error al actualizar estadísticas");
      } else {
        logger.info({ userId, type }, "Estadísticas de usuario actualizadas");
      }
    }
  } catch (error) {
    logger.error({ error }, "Error al actualizar estadísticas de usuario");
  }
}

/**
 * Tipos de notificaciones
 */
export type NotificationType =
  | "file_shared"
  | "file_downloaded"
  | "permission_revoked"
  | "file_expired";

/**
 * Crea una notificación para un usuario
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedPackageId?: string,
  relatedUserId?: string
): Promise<void> {
  try {
    const supabase = getSupabase();

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      related_package_id: relatedPackageId || null,
      related_user_id: relatedUserId || null,
      read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({ error, userId, type }, "Error al crear notificación");
    } else {
      logger.info({ userId, type, title }, "Notificación creada exitosamente");
    }
  } catch (error) {
    logger.error({ error }, "Error al crear notificación en la base de datos");
  }
}

/**
 * Notifica al uploader cuando alguien descarga su archivo
 */
export async function notifyFileDownloaded(
  packageId: string,
  uploaderId: string,
  downloaderId: string,
  filename: string
): Promise<void> {
  try {
    const supabase = getSupabase();

    // Obtener email del descargador
    const { data: downloaderProfile } = await supabase
      .from("user_profiles")
      .select("email, display_name")
      .eq("id", downloaderId)
      .single();

    const downloaderName =
      downloaderProfile?.display_name ||
      downloaderProfile?.email ||
      "Un usuario";

    await createNotification(
      uploaderId,
      "file_downloaded",
      "Archivo descargado",
      `${downloaderName} ha descargado tu archivo "${filename}"`,
      packageId,
      downloaderId
    );
  } catch (error) {
    logger.error({ error }, "Error al notificar descarga de archivo");
  }
}

/**
 * Notifica al receptor cuando le comparten un archivo
 */
export async function notifyFileShared(
  packageId: string,
  recipientId: string,
  uploaderId: string,
  filename: string
): Promise<void> {
  try {
    const supabase = getSupabase();

    // Obtener email del uploader
    const { data: uploaderProfile } = await supabase
      .from("user_profiles")
      .select("email, display_name")
      .eq("id", uploaderId)
      .single();

    const uploaderName =
      uploaderProfile?.display_name || uploaderProfile?.email || "Alguien";

    await createNotification(
      recipientId,
      "file_shared",
      "Nuevo archivo compartido",
      `${uploaderName} ha compartido "${filename}" contigo`,
      packageId,
      uploaderId
    );
  } catch (error) {
    logger.error({ error }, "Error al notificar archivo compartido");
  }
}

/**
 * Notifica cuando se revoca un permiso
 */
export async function notifyPermissionRevoked(
  packageId: string,
  recipientId: string,
  revokedById: string,
  filename: string
): Promise<void> {
  try {
    await createNotification(
      recipientId,
      "permission_revoked",
      "Acceso revocado",
      `Tu acceso al archivo "${filename}" ha sido revocado`,
      packageId,
      revokedById
    );
  } catch (error) {
    logger.error({ error }, "Error al notificar revocación de permiso");
  }
}

/**
 * Notifica cuando un archivo expira
 */
export async function notifyFileExpired(
  packageId: string,
  userId: string,
  filename: string
): Promise<void> {
  try {
    await createNotification(
      userId,
      "file_expired",
      "Archivo expirado",
      `Tu archivo "${filename}" ha expirado y ya no está disponible`,
      packageId
    );
  } catch (error) {
    logger.error({ error }, "Error al notificar expiración de archivo");
  }
}
