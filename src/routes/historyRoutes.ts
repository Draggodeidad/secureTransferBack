import { Router } from "express";
import {
  getMyUploads,
  getSharedWithMe,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserStats,
} from "../controllers/historyController.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     FileUpload:
 *       type: object
 *       properties:
 *         package_id:
 *           type: string
 *           format: uuid
 *         original_filename:
 *           type: string
 *         original_size:
 *           type: integer
 *         mime_type:
 *           type: string
 *         encrypted_size:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [active, expired, deleted, archived]
 *         expires_at:
 *           type: string
 *           format: date-time
 *         created_at:
 *           type: string
 *           format: date-time
 *         download_stats:
 *           type: object
 *           properties:
 *             total_downloads:
 *               type: integer
 *             last_download:
 *               type: string
 *               format: date-time
 *         file_permissions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               recipient_id:
 *                 type: string
 *                 format: uuid
 *               permission_type:
 *                 type: string
 *               downloads_count:
 *                 type: integer
 *               user_profiles:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: string
 *                   display_name:
 *                     type: string
 *     SharedFile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         package_id:
 *           type: string
 *           format: uuid
 *         permission_type:
 *           type: string
 *         downloads_count:
 *           type: integer
 *         max_downloads:
 *           type: integer
 *         granted_at:
 *           type: string
 *           format: date-time
 *         files:
 *           type: object
 *           properties:
 *             original_filename:
 *               type: string
 *             original_size:
 *               type: integer
 *             mime_type:
 *               type: string
 *             expires_at:
 *               type: string
 *               format: date-time
 *             user_profiles:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                 display_name:
 *                   type: string
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [file_shared, file_downloaded, permission_revoked, file_expired]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         related_package_id:
 *           type: string
 *           format: uuid
 *         read:
 *           type: boolean
 *         read_at:
 *           type: string
 *           format: date-time
 *         created_at:
 *           type: string
 *           format: date-time
 *     UserStats:
 *       type: object
 *       properties:
 *         total_uploads:
 *           type: integer
 *         total_downloads:
 *           type: integer
 *         storage_used_bytes:
 *           type: integer
 *         active_files:
 *           type: integer
 *         shared_with_me:
 *           type: integer
 *         unread_notifications:
 *           type: integer
 *     PaginationResponse:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         total:
 *           type: integer
 *         total_pages:
 *           type: integer
 */

/**
 * @swagger
 * /history/uploads:
 *   get:
 *     summary: Obtener archivos subidos por el usuario
 *     description: Lista todos los archivos que el usuario ha subido al sistema
 *     tags:
 *       - Historial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de resultados por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, deleted, archived, all]
 *           default: active
 *         description: Filtrar por estado del archivo
 *     responses:
 *       200:
 *         description: Lista de archivos subidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FileUpload'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get("/uploads", getMyUploads);

/**
 * @swagger
 * /history/shared:
 *   get:
 *     summary: Obtener archivos compartidos conmigo
 *     description: Lista todos los archivos que han sido compartidos con el usuario
 *     tags:
 *       - Historial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de resultados por página
 *       - in: query
 *         name: revoked
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: false
 *         description: Incluir archivos con permisos revocados
 *     responses:
 *       200:
 *         description: Lista de archivos compartidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SharedFile'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get("/shared", getSharedWithMe);

/**
 * @swagger
 * /history/notifications:
 *   get:
 *     summary: Obtener notificaciones del usuario
 *     description: Lista todas las notificaciones del usuario
 *     tags:
 *       - Historial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad de resultados por página
 *       - in: query
 *         name: read
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: all
 *         description: Filtrar por estado de lectura
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *                 unread_count:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get("/notifications", getNotifications);

/**
 * @swagger
 * /history/notifications/{id}/read:
 *   put:
 *     summary: Marcar notificación como leída
 *     description: Marca una notificación específica como leída
 *     tags:
 *       - Historial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la notificación
 *     responses:
 *       200:
 *         description: Notificación marcada como leída
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Notificación no encontrada
 *       500:
 *         description: Error del servidor
 */
router.put("/notifications/:id/read", markNotificationAsRead);

/**
 * @swagger
 * /history/notifications/read-all:
 *   put:
 *     summary: Marcar todas las notificaciones como leídas
 *     description: Marca todas las notificaciones no leídas del usuario como leídas
 *     tags:
 *       - Historial
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas las notificaciones marcadas como leídas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 updated_count:
 *                   type: integer
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.put("/notifications/read-all", markAllNotificationsAsRead);

/**
 * @swagger
 * /history/stats:
 *   get:
 *     summary: Obtener estadísticas del usuario
 *     description: Obtiene estadísticas generales del usuario (uploads, downloads, storage, etc.)
 *     tags:
 *       - Historial
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   $ref: '#/components/schemas/UserStats'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get("/stats", getUserStats);

export default router;
