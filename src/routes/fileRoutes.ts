import { Router } from "express";
import {
  uploadFile,
  downloadPackage,
  decryptPackage,
  getPackageMetadata,
  getPackageManifest,
  downloadDecryptedFile,
} from "../controllers/fileController.js";
import { upload } from "../middlewares/upload.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadResponse:
 *       type: object
 *       properties:
 *         packageId:
 *           type: string
 *           description: ID único del paquete
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         filename:
 *           type: string
 *           description: Nombre original del archivo
 *           example: "documento.pdf"
 *         size:
 *           type: integer
 *           description: Tamaño del archivo original en bytes
 *           example: 1048576
 *         encryptedSize:
 *           type: integer
 *           description: Tamaño del archivo cifrado en bytes
 *           example: 1049000
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de expiración del paquete
 *         downloadUrl:
 *           type: string
 *           description: URL para descargar el paquete
 *           example: "/download/550e8400-e29b-41d4-a716-446655440000"
 *     PackageMetadata:
 *       type: object
 *       properties:
 *         packageId:
 *           type: string
 *           description: ID único del paquete
 *         filename:
 *           type: string
 *           description: Nombre del archivo
 *         originalSize:
 *           type: integer
 *           description: Tamaño original en bytes
 *         encryptedSize:
 *           type: integer
 *           description: Tamaño cifrado en bytes
 *         mimeType:
 *           type: string
 *           description: Tipo MIME del archivo
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de subida
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de expiración
 *         status:
 *           type: string
 *           enum: [active, expired, downloaded, deleted]
 *           description: Estado del paquete
 *         uploaderId:
 *           type: string
 *           description: ID del usuario que subió el archivo
 *         uploaderPublicKeyFingerprint:
 *           type: string
 *           description: Fingerprint de la llave pública del remitente
 *         signature:
 *           type: string
 *           description: Firma digital del paquete
 *         downloadCount:
 *           type: integer
 *           description: Número de veces que se ha descargado
 *     DecryptRequest:
 *       type: object
 *       required:
 *         - packageId
 *         - privateKey
 *       properties:
 *         packageId:
 *           type: string
 *           description: ID del paquete a descifrar
 *         privateKey:
 *           type: string
 *           description: Llave privada del receptor para descifrar
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Mensaje de error
 */

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Subir un archivo para cifrado y transferencia segura
 *     description: |
 *       Sube un archivo, lo cifra y genera un paquete seguro con un ID único.
 *       El archivo se puede enviar a través de multipart/form-data.
 *     tags:
 *       - Archivos
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir
 *               userId:
 *                 type: string
 *                 description: ID del usuario que sube el archivo (opcional)
 *               publicKeyFingerprint:
 *                 type: string
 *                 description: Fingerprint de la llave pública para cifrar (opcional)
 *     responses:
 *       201:
 *         description: Archivo subido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: No se proporcionó archivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/upload", upload.single("file"), uploadFile);

/**
 * @swagger
 * /download/{packageId}:
 *   get:
 *     summary: Descargar un paquete cifrado (ZIP completo)
 *     description: |
 *       Descarga un paquete cifrado usando su ID único.
 *       El archivo se descarga en formato ZIP con manifest.json, encrypted_file.enc y README.txt.
 *       Para usuarios avanzados o debugging.
 *     tags:
 *       - Archivos
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único del paquete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Archivo ZIP descargado exitosamente
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Paquete no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       410:
 *         description: El paquete ha expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/download/:packageId", downloadPackage);

/**
 * @swagger
 * /download/{packageId}/decrypted:
 *   post:
 *     summary: Descargar archivo original descifrado directamente
 *     description: |
 *       Descarga el archivo original descifrado (PDF, imagen, etc.) directamente.
 *       Requiere la clave privada del receptor.
 *       Esta es la opción recomendada para usuarios finales.
 *     tags:
 *       - Archivos
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único del paquete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - privateKey
 *             properties:
 *               privateKey:
 *                 type: string
 *                 description: Clave privada RSA del receptor en formato PEM
 *                 example: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
 *     responses:
 *       200:
 *         description: Archivo original descifrado descargado exitosamente
 *         headers:
 *           X-File-Verified:
 *             description: Indica si la firma y hash fueron verificados
 *             schema:
 *               type: boolean
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Falta la clave privada o formato inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Paquete no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       410:
 *         description: El paquete ha expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor o error de descifrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/download/:packageId/decrypted", downloadDecryptedFile);

/**
 * @swagger
 * /decrypt:
 *   post:
 *     summary: Descifrar un paquete
 *     description: |
 *       Descifra un paquete usando la llave privada del receptor.
 *       Devuelve el archivo original descifrado o un link para descargarlo.
 *     tags:
 *       - Archivos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DecryptRequest'
 *     responses:
 *       200:
 *         description: Archivo descifrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 filename:
 *                   type: string
 *                   description: Nombre del archivo original
 *                 mimeType:
 *                   type: string
 *                   description: Tipo MIME del archivo
 *                 data:
 *                   type: string
 *                   format: base64
 *                   description: Datos del archivo en base64
 *                 message:
 *                   type: string
 *                   description: Mensaje de confirmación
 *       400:
 *         description: Faltan parámetros requeridos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Paquete no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       410:
 *         description: El paquete ha expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/decrypt", decryptPackage);

/**
 * @swagger
 * /metadata/{packageId}:
 *   get:
 *     summary: Obtener metadatos de un paquete
 *     description: |
 *       Obtiene información detallada sobre un paquete incluyendo
 *       estado, tamaño, fechas, firmante y estadísticas de descarga.
 *     tags:
 *       - Archivos
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único del paquete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Metadatos obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PackageMetadata'
 *       404:
 *         description: Paquete no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/metadata/:packageId", getPackageMetadata);

/**
 * @swagger
 * /manifest/{packageId}:
 *   get:
 *     summary: Obtener el manifest de un paquete
 *     description: |
 *       Obtiene el manifest.json del paquete ZIP que contiene
 *       los metadatos criptográficos necesarios para el descifrado.
 *     tags:
 *       - Archivos
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único del paquete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Manifest obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Paquete no encontrado
 *       501:
 *         description: Funcionalidad no implementada aún
 */
router.get("/manifest/:packageId", getPackageManifest);

export default router;
