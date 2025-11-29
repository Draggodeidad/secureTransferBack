import { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import logger from "../utils/logger.js";
import type { PublicKey } from "../types/index.js";

// Simulación de base de datos en memoria para llaves públicas
const publicKeysDB: Map<string, PublicKey> = new Map();
const userKeysIndex: Map<string, string[]> = new Map();

/**
 * Genera un fingerprint para una llave pública
 */
const generateFingerprint = (publicKey: string): string => {
  return crypto
    .createHash("sha256")
    .update(publicKey)
    .digest("hex")
    .substring(0, 16);
};

/**
 * Controlador para registrar una llave pública
 */
export const registerPublicKey = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, publicKey, algorithm = "RSA-4096" } = req.body;

    if (!userId || !publicKey) {
      res.status(400).json({
        error: "Se requiere userId y publicKey",
      });
      return;
    }

    const keyId = uuidv4();
    const fingerprint = generateFingerprint(publicKey);

    const keyRecord: PublicKey = {
      keyId,
      userId,
      publicKey,
      fingerprint,
      algorithm,
      createdAt: new Date(),
      isActive: true,
    };

    // Guardar llave en la base de datos
    publicKeysDB.set(keyId, keyRecord);

    // Actualizar índice de usuario
    const userKeys = userKeysIndex.get(userId) || [];
    userKeys.push(keyId);
    userKeysIndex.set(userId, userKeys);

    logger.info({ keyId, userId, fingerprint }, "Llave pública registrada");

    res.status(201).json({
      keyId,
      userId,
      fingerprint,
      algorithm,
      createdAt: keyRecord.createdAt,
      message: "Llave pública registrada exitosamente",
    });
  } catch (error) {
    logger.error(error, "Error al registrar llave pública");
    res.status(500).json({ error: "Error al registrar la llave pública" });
  }
};

/**
 * Controlador para listar llaves públicas de un usuario
 */
export const getUserKeys = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.params["id"];

    if (!userId) {
      res.status(400).json({ error: "Se requiere userId" });
      return;
    }

    const keyIds = userKeysIndex.get(userId) || [];
    const keys = keyIds
      .map((keyId) => publicKeysDB.get(keyId))
      .filter((key): key is PublicKey => key !== undefined)
      .filter((key) => key.isActive);

    logger.info({ userId, count: keys.length }, "Obteniendo llaves de usuario");

    res.status(200).json({
      userId,
      keys: keys.map((key) => ({
        keyId: key.keyId,
        fingerprint: key.fingerprint,
        algorithm: key.algorithm,
        createdAt: key.createdAt,
        isActive: key.isActive,
      })),
      total: keys.length,
    });
  } catch (error) {
    logger.error(error, "Error al obtener llaves de usuario");
    res.status(500).json({ error: "Error al obtener las llaves" });
  }
};
