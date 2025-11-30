import { createClient } from "@supabase/supabase-js";
import logger from "../utils/logger.js";
import * as crypto from "../services/cryptoService.js";

// Cliente de Supabase con autenticación
let supabaseAuthInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAuth() {
  if (!supabaseAuthInstance) {
    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseKey =
      process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
      process.env["SUPABASE_ANON_KEY"];

    if (!supabaseUrl || !supabaseKey) {
      logger.error(
        "Faltan credenciales de Supabase en las variables de entorno"
      );
      throw new Error("SUPABASE_URL y SUPABASE_ANON_KEY son requeridos");
    }
    supabaseAuthInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseAuthInstance;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  public_key: string;
  encrypted_private_key: string | null;
  total_uploads: number;
  total_downloads: number;
  storage_used_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserProfileInput {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  encryptPrivateKey?: boolean; // Si es true, cifra la clave privada con una contraseña
  password?: string; // Para cifrar la clave privada (opcional)
}

export interface SetupKeysResponse {
  publicKey: string;
  privateKey: string | null; // Solo se devuelve si no se cifra
  encryptedPrivateKey: string | null; // Se devuelve si se cifra
  fingerprint: string;
}

/**
 * Genera las claves RSA para un usuario y las guarda en la base de datos
 */
export async function setupUserKeys(
  input: CreateUserProfileInput
): Promise<SetupKeysResponse> {
  try {
    const supabase = getSupabaseAuth();

    // 1. Generar par de claves RSA
    logger.info({ userId: input.userId }, "Generando claves RSA para usuario");
    const keyPair = crypto.generateKeyPair();

    // 2. Calcular fingerprint de la clave pública
    const fingerprint = crypto.hash(Buffer.from(keyPair.publicKey));

    // 3. Opcionalmente cifrar la clave privada
    let encryptedPrivateKey: string | null = null;
    let privateKeyToReturn: string | null = null;

    if (input.encryptPrivateKey && input.password) {
      // Cifrar la clave privada con la contraseña del usuario
      const passwordKey = crypto.hash(Buffer.from(input.password));
      const passwordKeyBuffer = Buffer.from(passwordKey, "hex");

      const encrypted = crypto.aesEncrypt(
        Buffer.from(keyPair.privateKey),
        passwordKeyBuffer
      );

      // Serializar los datos cifrados
      encryptedPrivateKey = JSON.stringify({
        ciphertext: encrypted.ciphertext.toString("base64"),
        iv: encrypted.iv.toString("base64"),
        authTag: encrypted.authTag.toString("base64"),
      });
    } else {
      // No cifrar, devolver la clave privada directamente
      privateKeyToReturn = keyPair.privateKey;
    }

    // 4. Verificar si el perfil ya existe
    const { data: existingProfile, error: checkError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", input.userId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = No se encontró
      logger.error(
        { error: checkError },
        "Error al verificar perfil existente"
      );
      throw checkError;
    }

    // 5. Guardar o actualizar perfil en la base de datos
    if (existingProfile) {
      // Actualizar perfil existente
      const { error: updateError } = await supabase
        .from("user_profiles")
        // @ts-expect-error - Supabase types need custom schema
        .update({
          public_key: keyPair.publicKey,
          encrypted_private_key: encryptedPrivateKey,
          display_name: input.displayName || null,
          avatar_url: input.avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.userId);

      if (updateError) {
        logger.error(
          { error: updateError, userId: input.userId },
          "Error al actualizar perfil de usuario"
        );
        throw updateError;
      }

      logger.info({ userId: input.userId }, "Perfil de usuario actualizado");
    } else {
      // Crear nuevo perfil
      const { error: insertError } = await supabase
        .from("user_profiles")
        // @ts-expect-error - Supabase types need custom schema
        .insert({
          id: input.userId,
          email: input.email,
          public_key: keyPair.publicKey,
          encrypted_private_key: encryptedPrivateKey,
          display_name: input.displayName || null,
          avatar_url: input.avatarUrl || null,
        });

      if (insertError) {
        logger.error(
          { error: insertError, userId: input.userId },
          "Error al crear perfil de usuario"
        );
        throw insertError;
      }

      logger.info({ userId: input.userId }, "Perfil de usuario creado");
    }

    return {
      publicKey: keyPair.publicKey,
      privateKey: privateKeyToReturn,
      encryptedPrivateKey: encryptedPrivateKey,
      fingerprint,
    };
  } catch (error) {
    logger.error(
      { error, userId: input.userId },
      "Error al configurar claves de usuario"
    );
    throw error;
  }
}

/**
 * Obtiene el perfil de un usuario por su ID
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  try {
    const supabase = getSupabaseAuth();

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No se encontró
        return null;
      }
      logger.error({ error, userId }, "Error al obtener perfil de usuario");
      throw error;
    }

    return data as UserProfile;
  } catch (error) {
    logger.error({ error, userId }, "Error al obtener perfil de usuario");
    throw error;
  }
}

/**
 * Obtiene el perfil de un usuario por su email
 */
export async function getUserProfileByEmail(
  email: string
): Promise<UserProfile | null> {
  try {
    const supabase = getSupabaseAuth();

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error({ error, email }, "Error al obtener perfil por email");
      throw error;
    }

    return data as UserProfile;
  } catch (error) {
    logger.error({ error, email }, "Error al obtener perfil por email");
    throw error;
  }
}

/**
 * Actualiza el perfil de un usuario
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    displayName?: string;
    avatarUrl?: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseAuth();

    const { error } = await supabase
      .from("user_profiles")
      // @ts-expect-error - Supabase types need custom schema
      .update({
        display_name: updates.displayName,
        avatar_url: updates.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      logger.error({ error, userId }, "Error al actualizar perfil");
      throw error;
    }

    logger.info({ userId }, "Perfil actualizado exitosamente");
  } catch (error) {
    logger.error({ error, userId }, "Error al actualizar perfil");
    throw error;
  }
}

/**
 * Verifica si un usuario tiene claves configuradas
 */
export async function hasKeysConfigured(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfile(userId);
    return (
      profile !== null &&
      profile.public_key !== null &&
      profile.public_key !== ""
    );
  } catch (error) {
    logger.error({ error, userId }, "Error al verificar claves");
    return false;
  }
}

/**
 * Obtiene la clave pública de un usuario
 */
export async function getUserPublicKey(userId: string): Promise<string | null> {
  try {
    const profile = await getUserProfile(userId);
    // Retornar null si la clave pública está vacía o no existe
    if (!profile?.public_key || profile.public_key === "") {
      return null;
    }
    return profile.public_key;
  } catch (error) {
    logger.error({ error, userId }, "Error al obtener clave pública");
    throw error;
  }
}

/**
 * Incrementa el contador de uploads de un usuario
 */
export async function incrementUserUploads(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseAuth();

    // @ts-ignore - Supabase RPC types need custom schema
    const { error } = await supabase.rpc("increment_user_uploads", {
      user_id: userId,
    });

    if (error) {
      logger.error({ error, userId }, "Error al incrementar uploads");
      throw error;
    }
  } catch (error) {
    logger.error({ error, userId }, "Error al incrementar uploads");
    throw error;
  }
}

/**
 * Incrementa el contador de downloads de un usuario
 */
export async function incrementUserDownloads(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseAuth();

    // @ts-ignore - Supabase RPC types need custom schema
    const { error } = await supabase.rpc("increment_user_downloads", {
      user_id: userId,
    });

    if (error) {
      logger.error({ error, userId }, "Error al incrementar downloads");
      throw error;
    }
  } catch (error) {
    logger.error({ error, userId }, "Error al incrementar downloads");
    throw error;
  }
}
