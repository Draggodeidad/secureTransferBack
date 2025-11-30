import express from "express";
import * as authController from "../controllers/authController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Endpoints de autenticación y gestión de perfiles de usuario
 */

/**
 * @swagger
 * /auth/initialize:
 *   post:
 *     summary: Inicializa el usuario con claves RSA si no las tiene
 *     description: Endpoint idempotente que verifica si el usuario tiene claves y las genera si no existen. Ideal para llamar después del login.
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario ya inicializado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 hasKeys:
 *                   type: boolean
 *                 profile:
 *                   type: object
 *       201:
 *         description: Usuario inicializado con nuevas claves
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 hasKeys:
 *                   type: boolean
 *                 publicKey:
 *                   type: string
 *                 privateKey:
 *                   type: string
 *                 fingerprint:
 *                   type: string
 *                 warning:
 *                   type: string
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.post("/initialize", authController.initializeUser);

/**
 * @swagger
 * /auth/setup-keys:
 *   post:
 *     summary: Configura las claves RSA para un usuario autenticado
 *     description: Genera un par de claves RSA y las guarda en el perfil del usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: Nombre para mostrar del usuario
 *                 example: "Juan Pérez"
 *               avatarUrl:
 *                 type: string
 *                 description: URL del avatar del usuario
 *                 example: "https://example.com/avatar.jpg"
 *               encryptPrivateKey:
 *                 type: boolean
 *                 description: Si es true, cifra la clave privada con la contraseña proporcionada
 *                 default: false
 *               password:
 *                 type: string
 *                 description: Contraseña para cifrar la clave privada (requerido si encryptPrivateKey es true)
 *                 example: "miPasswordSegura123"
 *     responses:
 *       201:
 *         description: Claves generadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Claves generadas y configuradas exitosamente"
 *                 publicKey:
 *                   type: string
 *                   description: Clave pública en formato PEM
 *                 privateKey:
 *                   type: string
 *                   description: Clave privada en formato PEM (solo si no se cifra)
 *                 encryptedPrivateKey:
 *                   type: string
 *                   description: Clave privada cifrada (solo si se cifra)
 *                 fingerprint:
 *                   type: string
 *                   description: Huella digital de la clave pública
 *                 warning:
 *                   type: string
 *                   description: Advertencia sobre guardar la clave privada
 *       401:
 *         description: No autorizado
 *       409:
 *         description: El usuario ya tiene claves configuradas
 *       500:
 *         description: Error interno del servidor
 */
router.post("/setup-keys", authController.setupKeys);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Obtiene el perfil del usuario autenticado
 *     description: Devuelve la información del perfil del usuario (sin la clave privada)
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     avatar_url:
 *                       type: string
 *                     public_key:
 *                       type: string
 *                     total_uploads:
 *                       type: integer
 *                     total_downloads:
 *                       type: integer
 *                     storage_used_bytes:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 hasKeys:
 *                   type: boolean
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Perfil no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/profile", authController.getProfile);

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Actualiza el perfil del usuario autenticado
 *     description: Permite actualizar el nombre para mostrar y el avatar del usuario
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 example: "Juan Pérez"
 *               avatarUrl:
 *                 type: string
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.put("/profile", authController.updateProfile);

/**
 * @swagger
 * /auth/check-keys:
 *   get:
 *     summary: Verifica si el usuario tiene claves configuradas
 *     description: Devuelve si el usuario autenticado tiene un par de claves RSA configurado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de las claves
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 hasKeys:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno del servidor
 */
router.get("/check-keys", authController.checkKeys);

/**
 * @swagger
 * /auth/user/{userId}/public-key:
 *   get:
 *     summary: Obtiene la clave pública de un usuario
 *     description: Endpoint público para obtener la clave pública RSA de cualquier usuario
 *     tags: [Autenticación]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Clave pública obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 publicKey:
 *                   type: string
 *                   description: Clave pública en formato PEM
 *       404:
 *         description: Usuario no encontrado o no tiene clave pública
 *       500:
 *         description: Error interno del servidor
 */
router.get("/user/:userId/public-key", authController.getUserPublicKey);

/**
 * @swagger
 * /auth/user/email/{email}/public-key:
 *   get:
 *     summary: Obtiene la clave pública de un usuario por email
 *     description: Endpoint público para obtener la clave pública RSA de un usuario buscando por email
 *     tags: [Autenticación]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email del usuario
 *     responses:
 *       200:
 *         description: Clave pública obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 email:
 *                   type: string
 *                 publicKey:
 *                   type: string
 *                   description: Clave pública en formato PEM
 *       404:
 *         description: Usuario no encontrado o no tiene clave pública
 *       500:
 *         description: Error interno del servidor
 */
router.get(
  "/user/email/:email/public-key",
  authController.getUserPublicKeyByEmail
);

export default router;
