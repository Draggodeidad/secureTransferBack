import type { Request, Response } from "express";
import logger from "../utils/logger.js";
import * as userService from "../services/userService.js";
import { createClient } from "@supabase/supabase-js";

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
 * POST /auth/initialize
 * Inicializa el perfil del usuario con claves si no las tiene
 * Este endpoint es idempotente: si ya tiene claves, no hace nada
 */
export async function initializeUser(
  req: Request,
  res: Response
): Promise<void> {
  try {
    logger.info("📥 =====================================");
    logger.info("📥 INICIO - Solicitud a /auth/initialize");
    logger.info("📥 =====================================");

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("❌ Token de autenticación faltante o mal formado");
      res.status(401).json({
        error: "No autorizado",
        message: "Token de autenticación requerido",
      });
      return;
    }

    const token = authHeader.substring(7);
    logger.info(
      `🔐 Token extraído (primeros 20 chars): ${token.substring(0, 20)}...`
    );

    const supabase = getSupabase();
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      logger.error(
        { error: authError },
        "❌ Error al verificar token con Supabase"
      );
      res.status(401).json({
        error: "No autorizado",
        message: "Token inválido o expirado",
      });
      return;
    }

    const userId = userData.user.id;
    const email = userData.user.email!;

    logger.info({ userId, email }, "✅ Usuario autenticado correctamente");
    logger.info({ userId, email }, "🔍 Verificando si tiene claves...");

    // Verificar si ya tiene claves
    const hasKeys = await userService.hasKeysConfigured(userId);
    logger.info(
      { userId, hasKeys },
      `🔑 Estado de claves: ${hasKeys ? "YA TIENE" : "NO TIENE"}`
    );

    if (hasKeys) {
      // Ya tiene claves, devolver el perfil actual
      logger.info(
        { userId },
        "✅ Usuario ya tiene claves, devolviendo perfil existente"
      );
      const profile = await userService.getUserProfile(userId);

      res.status(200).json({
        message: "Usuario ya inicializado",
        hasKeys: true,
        profile: {
          id: profile!.id,
          email: profile!.email,
          display_name: profile!.display_name,
          avatar_url: profile!.avatar_url,
          public_key: profile!.public_key,
        },
      });

      logger.info("📤 Respuesta enviada (200): Usuario ya inicializado");
      return;
    }

    // No tiene claves, generarlas
    logger.info({ userId }, "🔨 Generando nuevas claves RSA...");

    const displayName =
      userData.user.user_metadata?.["full_name"] ||
      userData.user.user_metadata?.["name"] ||
      null;

    const avatarUrl =
      userData.user.user_metadata?.["avatar_url"] ||
      userData.user.user_metadata?.["picture"] ||
      null;

    logger.info(
      { userId, displayName, avatarUrl },
      "📋 Metadatos extraídos de usuario"
    );

    const result = await userService.setupUserKeys({
      userId,
      email,
      displayName,
      avatarUrl,
      encryptPrivateKey: false, // No cifrar por defecto
    });

    logger.info(
      { userId, fingerprint: result.fingerprint },
      "🎉 ¡Claves generadas exitosamente!"
    );
    logger.info(
      {
        userId,
        hasPublicKey: !!result.publicKey,
        hasPrivateKey: !!result.privateKey,
      },
      "🔑 Claves en respuesta"
    );

    res.status(201).json({
      message: "Usuario inicializado exitosamente",
      hasKeys: true,
      publicKey: result.publicKey,
      privateKey: result.privateKey,
      fingerprint: result.fingerprint,
      warning:
        "⚠️ IMPORTANTE: Guarda tu clave privada. No la guardamos en el servidor.",
    });

    logger.info(
      "📤 Respuesta enviada (201): Usuario inicializado con nuevas claves"
    );
    logger.info("✅ =====================================");
    logger.info("✅ FIN - Solicitud a /auth/initialize");
    logger.info("✅ =====================================");
  } catch (error) {
    logger.error({ error }, "💥 ERROR CRÍTICO en initializeUser");
    logger.error(
      {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "💥 Detalles del error"
    );

    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al inicializar el usuario",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * POST /auth/setup-keys
 * Genera y configura las claves RSA para un usuario autenticado
 */
export async function setupKeys(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token de autenticación requerido",
      });
      return;
    }

    // Extraer el token JWT
    const token = authHeader.substring(7);

    // Verificar el token con Supabase
    const supabase = getSupabase();
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      logger.error({ error: authError }, "Error al verificar token");
      res.status(401).json({
        error: "No autorizado",
        message: "Token inválido o expirado",
      });
      return;
    }

    const userId = userData.user.id;
    const email = userData.user.email!;

    // Obtener datos opcionales del body
    const {
      displayName,
      avatarUrl,
      encryptPrivateKey = false,
      password,
    } = req.body;

    // Validar que si se quiere cifrar la clave privada, se proporcione contraseña
    if (encryptPrivateKey && !password) {
      res.status(400).json({
        error: "Bad Request",
        message: "Si encryptPrivateKey es true, debe proporcionar un password",
      });
      return;
    }

    logger.info({ userId, email }, "Configurando claves para usuario");

    // Verificar si el usuario ya tiene claves configuradas
    const hasKeys = await userService.hasKeysConfigured(userId);

    if (hasKeys) {
      logger.warn({ userId }, "Usuario ya tiene claves configuradas");
      res.status(409).json({
        error: "Conflicto",
        message: "El usuario ya tiene claves configuradas",
        hint: "Si desea regenerar las claves, primero debe eliminarlas",
      });
      return;
    }

    // Generar y guardar las claves
    const result = await userService.setupUserKeys({
      userId,
      email,
      displayName,
      avatarUrl,
      encryptPrivateKey,
      password,
    });

    logger.info({ userId }, "Claves configuradas exitosamente");

    // Responder según si se cifró la clave privada o no
    if (encryptPrivateKey) {
      res.status(201).json({
        message: "Claves generadas y configuradas exitosamente",
        publicKey: result.publicKey,
        encryptedPrivateKey: result.encryptedPrivateKey,
        fingerprint: result.fingerprint,
        warning:
          "Guarda la clave privada cifrada y la contraseña de forma segura. No podrás recuperarla si la pierdes.",
      });
    } else {
      res.status(201).json({
        message: "Claves generadas y configuradas exitosamente",
        publicKey: result.publicKey,
        privateKey: result.privateKey,
        fingerprint: result.fingerprint,
        warning:
          "⚠️ IMPORTANTE: Guarda tu clave privada en un lugar seguro. No podrás recuperarla si la pierdes y no la guardamos en el servidor.",
      });
    }
  } catch (error) {
    logger.error({ error }, "Error al configurar claves");
    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al generar las claves del usuario",
    });
  }
}

/**
 * GET /auth/profile
 * Obtiene el perfil del usuario autenticado
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token de autenticación requerido",
      });
      return;
    }

    const token = authHeader.substring(7);
    const supabase = getSupabase();
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token inválido o expirado",
      });
      return;
    }

    const userId = userData.user.id;
    const profile = await userService.getUserProfile(userId);

    if (!profile) {
      res.status(404).json({
        error: "No encontrado",
        message: "Perfil de usuario no encontrado",
        hint: "Usa POST /auth/setup-keys para configurar tu perfil",
      });
      return;
    }

    // No devolver la clave privada cifrada en esta respuesta
    const { encrypted_private_key, ...profileData } = profile;

    res.status(200).json({
      profile: profileData,
      hasKeys: !!profile.public_key,
    });
  } catch (error) {
    logger.error({ error }, "Error al obtener perfil");
    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al obtener el perfil del usuario",
    });
  }
}

/**
 * GET /auth/check-keys
 * Verifica si el usuario tiene claves configuradas
 */
export async function checkKeys(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token de autenticación requerido",
      });
      return;
    }

    const token = authHeader.substring(7);
    const supabase = getSupabase();
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token inválido o expirado",
      });
      return;
    }

    const userId = userData.user.id;
    const hasKeys = await userService.hasKeysConfigured(userId);

    res.status(200).json({
      userId,
      hasKeys,
      message: hasKeys
        ? "Usuario tiene claves configuradas"
        : "Usuario no tiene claves configuradas",
    });
  } catch (error) {
    logger.error({ error }, "Error al verificar claves");
    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al verificar las claves del usuario",
    });
  }
}

/**
 * PUT /auth/profile
 * Actualiza el perfil del usuario autenticado
 */
export async function updateProfile(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token de autenticación requerido",
      });
      return;
    }

    const token = authHeader.substring(7);
    const supabase = getSupabase();
    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      res.status(401).json({
        error: "No autorizado",
        message: "Token inválido o expirado",
      });
      return;
    }

    const userId = userData.user.id;
    const { displayName, avatarUrl } = req.body;

    await userService.updateUserProfile(userId, {
      displayName,
      avatarUrl,
    });

    res.status(200).json({
      message: "Perfil actualizado exitosamente",
    });
  } catch (error) {
    logger.error({ error }, "Error al actualizar perfil");
    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al actualizar el perfil del usuario",
    });
  }
}

/**
 * GET /auth/user/:userId/public-key
 * Obtiene la clave pública de un usuario (público)
 */
export async function getUserPublicKey(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: "Bad Request",
        message: "userId es requerido",
      });
      return;
    }

    const publicKey = await userService.getUserPublicKey(userId);

    if (!publicKey) {
      res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado o no tiene clave pública configurada",
      });
      return;
    }

    res.status(200).json({
      userId,
      publicKey,
    });
  } catch (error) {
    logger.error({ error }, "Error al obtener clave pública");
    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al obtener la clave pública del usuario",
    });
  }
}

/**
 * GET /auth/user/email/:email/public-key
 * Obtiene la clave pública de un usuario por email (público)
 */
export async function getUserPublicKeyByEmail(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email } = req.params;

    if (!email) {
      res.status(400).json({
        error: "Bad Request",
        message: "email es requerido",
      });
      return;
    }

    const profile = await userService.getUserProfileByEmail(email);

    if (!profile || !profile.public_key) {
      res.status(404).json({
        error: "No encontrado",
        message: "Usuario no encontrado o no tiene clave pública configurada",
      });
      return;
    }

    res.status(200).json({
      userId: profile.id,
      email: profile.email,
      publicKey: profile.public_key,
    });
  } catch (error) {
    logger.error({ error }, "Error al obtener clave pública por email");
    res.status(500).json({
      error: "Error interno del servidor",
      message: "Error al obtener la clave pública del usuario",
    });
  }
}
