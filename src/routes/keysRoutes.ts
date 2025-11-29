import { Router } from "express";
import {
  registerPublicKey,
  getUserKeys,
} from "../controllers/keysController.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PublicKey:
 *       type: object
 *       properties:
 *         keyId:
 *           type: string
 *           description: ID único de la llave
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         userId:
 *           type: string
 *           description: ID del usuario propietario
 *           example: "user123"
 *         publicKey:
 *           type: string
 *           description: Llave pública en formato PEM
 *         fingerprint:
 *           type: string
 *           description: Fingerprint único de la llave
 *           example: "a3b5c7d9e1f3a5b7"
 *         algorithm:
 *           type: string
 *           description: Algoritmo de cifrado usado
 *           example: "RSA-4096"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         isActive:
 *           type: boolean
 *           description: Si la llave está activa
 *     RegisterKeyRequest:
 *       type: object
 *       required:
 *         - userId
 *         - publicKey
 *       properties:
 *         userId:
 *           type: string
 *           description: ID del usuario
 *           example: "user123"
 *         publicKey:
 *           type: string
 *           description: Llave pública en formato PEM
 *           example: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg..."
 *         algorithm:
 *           type: string
 *           description: Algoritmo de cifrado (opcional, por defecto RSA-4096)
 *           example: "RSA-4096"
 *     RegisterKeyResponse:
 *       type: object
 *       properties:
 *         keyId:
 *           type: string
 *           description: ID único de la llave registrada
 *         userId:
 *           type: string
 *           description: ID del usuario
 *         fingerprint:
 *           type: string
 *           description: Fingerprint de la llave
 *         algorithm:
 *           type: string
 *           description: Algoritmo utilizado
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Fecha de registro
 *         message:
 *           type: string
 *           description: Mensaje de confirmación
 *     UserKeysResponse:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: ID del usuario
 *         keys:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               keyId:
 *                 type: string
 *               fingerprint:
 *                 type: string
 *               algorithm:
 *                 type: string
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               isActive:
 *                 type: boolean
 *         total:
 *           type: integer
 *           description: Número total de llaves
 */

/**
 * @swagger
 * /keys/public:
 *   post:
 *     summary: Registrar una llave pública
 *     description: |
 *       Registra una llave pública de un usuario en el sistema.
 *       La llave se puede usar posteriormente para cifrar archivos
 *       destinados a ese usuario.
 *     tags:
 *       - Llaves
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterKeyRequest'
 *     responses:
 *       201:
 *         description: Llave pública registrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterKeyResponse'
 *       400:
 *         description: Faltan parámetros requeridos
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
router.post("/public", registerPublicKey);

/**
 * @swagger
 * /keys/users/{id}:
 *   get:
 *     summary: Listar llaves públicas de un usuario
 *     description: |
 *       Obtiene todas las llaves públicas activas asociadas
 *       a un usuario específico.
 *     tags:
 *       - Llaves
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *         example: "user123"
 *     responses:
 *       200:
 *         description: Lista de llaves obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserKeysResponse'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/users/:id", getUserKeys);

export default router;
