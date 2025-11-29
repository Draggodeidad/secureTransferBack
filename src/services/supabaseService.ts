import { createClient } from "@supabase/supabase-js";
import logger from "../utils/logger.js";

// Cliente de Supabase (lazy initialization)
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseInstance) {
    // ⚠️ IMPORTANTE: Leer las variables AQUÍ, cuando se llama la función, no en el nivel superior
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
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

// Exportar el cliente (se inicializa al primer uso)
export const supabase = {
  get storage() {
    return getSupabase().storage;
  },
};

// Nombre del bucket (leer cuando se necesita)
export const BUCKET_NAME = process.env["SUPABASE_BUCKET_NAME"] || "fileStorage";

/**
 * Verifica si el bucket existe, si no lo crea
 */
export async function ensureBucketExists(): Promise<void> {
  try {
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      logger.error({ error: listError }, "Error al listar buckets");
      throw listError;
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      logger.info(`Bucket ${BUCKET_NAME} no existe, creándolo...`);
      const { error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: false,
          fileSizeLimit: 52428800, // 50 MB en bytes
        }
      );

      if (createError) {
        logger.error({ error: createError }, "Error al crear bucket");
        throw createError;
      }

      logger.info(`Bucket ${BUCKET_NAME} creado exitosamente`);
    } else {
      logger.info(`Bucket ${BUCKET_NAME} ya existe`);
    }
  } catch (error) {
    logger.error({ error }, "Error al verificar/crear bucket");
    throw error;
  }
}

/**
 * Sube un archivo al bucket de Supabase
 */
export async function uploadFileToSupabase(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ path: string; publicUrl: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      logger.error({ error, fileName }, "Error al subir archivo a Supabase");
      throw error;
    }

    // Obtener URL pública (aunque el bucket sea privado, podemos usar URLs firmadas después)
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    logger.info(
      { fileName, path: data.path },
      "Archivo subido exitosamente a Supabase"
    );

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  } catch (error) {
    logger.error({ error, fileName }, "Error al subir archivo");
    throw error;
  }
}

/**
 * Descarga un archivo desde Supabase
 */
export async function downloadFileFromSupabase(
  filePath: string
): Promise<Blob> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      logger.error(
        { error, filePath },
        "Error al descargar archivo de Supabase"
      );
      throw error;
    }

    if (!data) {
      throw new Error("Archivo no encontrado");
    }

    logger.info({ filePath }, "Archivo descargado exitosamente de Supabase");
    return data;
  } catch (error) {
    logger.error({ error, filePath }, "Error al descargar archivo");
    throw error;
  }
}

/**
 * Elimina un archivo de Supabase
 */
export async function deleteFileFromSupabase(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      logger.error(
        { error, filePath },
        "Error al eliminar archivo de Supabase"
      );
      throw error;
    }

    logger.info({ filePath }, "Archivo eliminado exitosamente de Supabase");
  } catch (error) {
    logger.error({ error, filePath }, "Error al eliminar archivo");
    throw error;
  }
}

/**
 * Crea una URL firmada temporal para descargar un archivo
 */
export async function createSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      logger.error({ error, filePath }, "Error al crear URL firmada");
      throw error;
    }

    if (!data) {
      throw new Error("No se pudo crear URL firmada");
    }

    logger.info({ filePath, expiresIn }, "URL firmada creada exitosamente");
    return data.signedUrl;
  } catch (error) {
    logger.error({ error, filePath }, "Error al crear URL firmada");
    throw error;
  }
}
