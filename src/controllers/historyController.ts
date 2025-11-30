import type { Request, Response } from "express";
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
 * Helper para obtener el usuario autenticado desde el token
 */
async function getAuthenticatedUser(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Token de autenticación requerido");
  }

  const token = authHeader.substring(7);
  const supabase = getSupabase();
  const { data: userData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !userData.user) {
    throw new Error("Token inválido o expirado");
  }

  return userData.user;
}

/**
 * GET /history/uploads
 * Obtiene todos los archivos subidos por el usuario autenticado
 */
export async function getMyUploads(req: Request, res: Response): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user.id;

    const { page = "1", limit = "10", status = "active" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    logger.info(
      { userId, page: pageNum, limit: limitNum, status },
      "Obteniendo archivos subidos por usuario"
    );

    const supabase = getSupabase();

    // Query para obtener los archivos subidos
    let query = supabase
      .from("files")
      .select(
        `
        package_id,
        original_filename,
        original_size,
        mime_type,
        file_hash,
        encrypted_size,
        max_downloads,
        expires_at,
        allow_reshare,
        require_auth,
        status,
        created_at,
        updated_at,
        file_permissions!inner (
          id,
          recipient_id,
          permission_type,
          max_downloads,
          downloads_count,
          revoked,
          granted_at
        )
      `,
        { count: "exact" }
      )
      .eq("uploader_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Filtrar por estado si se especifica
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: files, error, count } = await query;

    if (error) {
      logger.error({ error, userId }, "Error al obtener archivos subidos");
      res.status(500).json({
        error: "Error al obtener archivos",
        details: error.message,
      });
      return;
    }

    // Obtener estadísticas de descargas y permisos para cada archivo
    const filesWithStats = await Promise.all(
      (files || []).map(async (file) => {
        const { data: downloadStats } = await supabase
          .from("download_logs")
          .select("id, downloaded_at, success")
          .eq("package_id", file.package_id)
          .order("downloaded_at", { ascending: false })
          .limit(1);

        const { count: totalDownloads } = await supabase
          .from("download_logs")
          .select("*", { count: "exact", head: true })
          .eq("package_id", file.package_id)
          .eq("success", true);

        // Obtener información de los receptores (usuarios con permisos)
        const { data: permissions } = await supabase
          .from("file_permissions")
          .select(
            `
            id,
            recipient_id,
            permission_type,
            max_downloads,
            downloads_count,
            revoked,
            granted_at
          `
          )
          .eq("package_id", file.package_id);

        // Obtener emails de los receptores
        const permissionsWithUsers = await Promise.all(
          (permissions || []).map(async (perm) => {
            const { data: userProfile } = await supabase
              .from("user_profiles")
              .select("email, display_name")
              .eq("id", perm.recipient_id)
              .single();

            return {
              ...perm,
              user_profiles: userProfile,
            };
          })
        );

        return {
          ...file,
          download_stats: {
            total_downloads: totalDownloads || 0,
            last_download: downloadStats?.[0]?.downloaded_at || null,
          },
          file_permissions: permissionsWithUsers,
        };
      })
    );

    res.json({
      success: true,
      data: filesWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err }, "Error en getMyUploads");
    if (err.message.includes("Token")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Error al obtener archivos subidos" });
    }
  }
}

/**
 * GET /history/shared
 * Obtiene todos los archivos compartidos con el usuario autenticado
 */
export async function getSharedWithMe(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user.id;

    const { page = "1", limit = "10", revoked = "false" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    logger.info(
      { userId, page: pageNum, limit: limitNum },
      "Obteniendo archivos compartidos con usuario"
    );

    const supabase = getSupabase();

    // Query para obtener los permisos del usuario
    let query = supabase
      .from("file_permissions")
      .select(
        `
        id,
        package_id,
        permission_type,
        max_downloads,
        downloads_count,
        revoked,
        revoked_at,
        granted_at,
        first_accessed_at,
        last_accessed_at
      `,
        { count: "exact" }
      )
      .eq("recipient_id", userId)
      .order("granted_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Filtrar archivos revocados si se especifica
    if (revoked === "false") {
      query = query.eq("revoked", false);
    }

    const { data: permissions, error, count } = await query;

    if (error) {
      logger.error({ error, userId }, "Error al obtener archivos compartidos");
      res.status(500).json({
        error: "Error al obtener archivos compartidos",
        details: error.message,
      });
      return;
    }

    // Obtener información de archivos y remitentes para cada permiso
    const permissionsWithFiles = await Promise.all(
      (permissions || []).map(async (perm) => {
        // Obtener información del archivo
        const { data: file } = await supabase
          .from("files")
          .select(
            `
            package_id,
            original_filename,
            original_size,
            mime_type,
            encrypted_size,
            expires_at,
            status,
            created_at,
            uploader_id
          `
          )
          .eq("package_id", perm.package_id)
          .single();

        // Obtener información del remitente
        const { data: uploader } = await supabase
          .from("user_profiles")
          .select("email, display_name")
          .eq("id", file?.uploader_id)
          .single();

        return {
          ...perm,
          files: file
            ? {
                ...file,
                user_profiles: uploader,
              }
            : null,
        };
      })
    );

    // Filtrar archivos que no estén expirados o borrados (a menos que se especifique)
    const activePermissions = permissionsWithFiles.filter((perm) => {
      const file = perm.files as any;
      return file && file.status !== "deleted";
    });

    res.json({
      success: true,
      data: activePermissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err }, "Error en getSharedWithMe");
    if (err.message.includes("Token")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Error al obtener archivos compartidos" });
    }
  }
}

/**
 * GET /history/notifications
 * Obtiene las notificaciones del usuario autenticado
 */
export async function getNotifications(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user.id;

    const { page = "1", limit = "20", read = "all" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    logger.info(
      { userId, page: pageNum, limit: limitNum, read },
      "Obteniendo notificaciones del usuario"
    );

    const supabase = getSupabase();

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Filtrar por leído/no leído
    if (read === "true") {
      query = query.eq("read", true);
    } else if (read === "false") {
      query = query.eq("read", false);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      logger.error({ error, userId }, "Error al obtener notificaciones");
      res.status(500).json({
        error: "Error al obtener notificaciones",
        details: error.message,
      });
      return;
    }

    // Obtener conteo de notificaciones no leídas
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    res.json({
      success: true,
      data: notifications || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
      },
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err }, "Error en getNotifications");
    if (err.message.includes("Token")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Error al obtener notificaciones" });
    }
  }
}

/**
 * PUT /history/notifications/:id/read
 * Marca una notificación como leída
 */
export async function markNotificationAsRead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user.id;
    const notificationId = req.params["id"];

    logger.info({ userId, notificationId }, "Marcando notificación como leída");

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", userId) // Asegurar que solo el dueño pueda marcar como leída
      .select()
      .single();

    if (error) {
      logger.error(
        { error, notificationId },
        "Error al marcar notificación como leída"
      );
      res.status(500).json({
        error: "Error al actualizar notificación",
        details: error.message,
      });
      return;
    }

    if (!data) {
      res.status(404).json({
        error: "Notificación no encontrada",
      });
      return;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err }, "Error en markNotificationAsRead");
    if (err.message.includes("Token")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Error al marcar notificación" });
    }
  }
}

/**
 * PUT /history/notifications/read-all
 * Marca todas las notificaciones del usuario como leídas
 */
export async function markAllNotificationsAsRead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user.id;

    logger.info({ userId }, "Marcando todas las notificaciones como leídas");

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("read", false)
      .select();

    if (error) {
      logger.error(
        { error, userId },
        "Error al marcar todas las notificaciones como leídas"
      );
      res.status(500).json({
        error: "Error al actualizar notificaciones",
        details: error.message,
      });
      return;
    }

    res.json({
      success: true,
      updated_count: data?.length || 0,
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err }, "Error en markAllNotificationsAsRead");
    if (err.message.includes("Token")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Error al marcar notificaciones" });
    }
  }
}

/**
 * GET /history/stats
 * Obtiene estadísticas generales del usuario
 */
export async function getUserStats(req: Request, res: Response): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user.id;

    logger.info({ userId }, "Obteniendo estadísticas del usuario");

    const supabase = getSupabase();

    // Obtener perfil del usuario con estadísticas
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("total_uploads, total_downloads, storage_used_bytes")
      .eq("id", userId)
      .single();

    if (profileError) {
      logger.error({ error: profileError }, "Error al obtener perfil");
      res.status(500).json({
        error: "Error al obtener estadísticas",
        details: profileError.message,
      });
      return;
    }

    // Archivos activos
    const { count: activeFiles } = await supabase
      .from("files")
      .select("*", { count: "exact", head: true })
      .eq("uploader_id", userId)
      .eq("status", "active");

    // Archivos compartidos conmigo (activos)
    const { count: sharedWithMe } = await supabase
      .from("file_permissions")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("revoked", false);

    // Notificaciones no leídas
    const { count: unreadNotifications } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    res.json({
      success: true,
      stats: {
        total_uploads: profile?.total_uploads || 0,
        total_downloads: profile?.total_downloads || 0,
        storage_used_bytes: profile?.storage_used_bytes || 0,
        active_files: activeFiles || 0,
        shared_with_me: sharedWithMe || 0,
        unread_notifications: unreadNotifications || 0,
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err }, "Error en getUserStats");
    if (err.message.includes("Token")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  }
}
