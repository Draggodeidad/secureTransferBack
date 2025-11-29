/**
 * EJEMPLOS DE USO DEL SERVICIO DE CRIPTOGRAFÍA
 *
 * Este archivo muestra cómo usar las diferentes funciones del cryptoService
 * NO ejecutar en producción - solo para referencia
 */

import {
  generateSessionKey,
  aesEncrypt,
  aesDecrypt,
  hash,
  generateKeyPair,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  sign,
  verify,
  serializeEncryptedData,
  deserializeEncryptedData,
  bufferToBase64,
} from "./cryptoService.js";

// ============================================
// EJEMPLO 1: Cifrado simétrico (AES-256-GCM)
// ============================================
function ejemploCifradoSimetrico() {
  console.log("\n=== EJEMPLO 1: Cifrado Simétrico ===\n");

  // 1. Generar clave de sesión
  const sessionKey = generateSessionKey();
  console.log("Clave de sesión generada:", bufferToBase64(sessionKey));

  // 2. Datos a cifrar
  const datosOriginales = Buffer.from("Este es un mensaje secreto", "utf-8");
  console.log("Datos originales:", datosOriginales.toString("utf-8"));

  // 3. Cifrar
  const encrypted = aesEncrypt(datosOriginales, sessionKey);
  console.log("Datos cifrados:", bufferToBase64(encrypted.ciphertext));
  console.log("IV:", bufferToBase64(encrypted.iv));
  console.log("Auth Tag:", bufferToBase64(encrypted.authTag));

  // 4. Descifrar
  const descifrado = aesDecrypt(
    encrypted.ciphertext,
    sessionKey,
    encrypted.iv,
    encrypted.authTag
  );
  console.log("Datos descifrados:", descifrado.toString("utf-8"));
}

// ============================================
// EJEMPLO 2: Cifrado de archivos
// ============================================
function ejemploCifradoArchivo() {
  console.log("\n=== EJEMPLO 2: Cifrado de Archivo ===\n");

  // Simular contenido de archivo
  const archivoBuffer = Buffer.from(
    "Contenido confidencial del archivo",
    "utf-8"
  );

  // 1. Generar clave de sesión
  const sessionKey = generateSessionKey();

  // 2. Cifrar archivo
  const archivoCifrado = aesEncrypt(archivoBuffer, sessionKey);

  // 3. Serializar para almacenamiento/transmisión
  const jsonCifrado = serializeEncryptedData(archivoCifrado);
  console.log("Archivo cifrado serializado:", jsonCifrado);

  // 4. Deserializar y descifrar
  const archivoCifradoDeserializado = deserializeEncryptedData(jsonCifrado);
  const archivoDescifrado = aesDecrypt(
    archivoCifradoDeserializado.ciphertext,
    sessionKey,
    archivoCifradoDeserializado.iv,
    archivoCifradoDeserializado.authTag
  );
  console.log("Archivo descifrado:", archivoDescifrado.toString("utf-8"));
}

// ============================================
// EJEMPLO 3: Criptografía asimétrica (RSA)
// ============================================
function ejemploCifradoAsimetrico() {
  console.log("\n=== EJEMPLO 3: Cifrado Asimétrico (RSA) ===\n");

  // 1. Generar par de claves RSA
  const { publicKey, privateKey } = generateKeyPair();
  console.log("Clave pública generada:\n", publicKey);
  console.log(
    "Clave privada generada:\n",
    privateKey.substring(0, 100) + "..."
  );

  // 2. Generar clave de sesión
  const sessionKey = generateSessionKey();
  console.log("\nClave de sesión:", bufferToBase64(sessionKey));

  // 3. Cifrar clave de sesión con clave pública
  const sessionKeyCifrada = encryptWithPublicKey(sessionKey, publicKey);
  console.log("Clave de sesión cifrada:", bufferToBase64(sessionKeyCifrada));

  // 4. Descifrar clave de sesión con clave privada
  const sessionKeyDescifrada = decryptWithPrivateKey(
    sessionKeyCifrada,
    privateKey
  );
  console.log(
    "Clave de sesión descifrada:",
    bufferToBase64(sessionKeyDescifrada)
  );
  console.log("¿Claves coinciden?", sessionKey.equals(sessionKeyDescifrada));
}

// ============================================
// EJEMPLO 4: Hashing y firma digital
// ============================================
function ejemploHashYFirma() {
  console.log("\n=== EJEMPLO 4: Hash y Firma Digital ===\n");

  // 1. Datos originales
  const datos = Buffer.from("Documento importante", "utf-8");
  console.log("Datos:", datos.toString("utf-8"));

  // 2. Generar hash
  const hashDatos = hash(datos);
  console.log("Hash SHA-256:", hashDatos);

  // 3. Generar par de claves
  const { publicKey, privateKey } = generateKeyPair();

  // 4. Firmar hash con clave privada
  const firma = sign(hashDatos, privateKey);
  console.log("Firma digital:", bufferToBase64(firma));

  // 5. Verificar firma con clave pública
  const firmaValida = verify(firma, hashDatos, publicKey);
  console.log("¿Firma válida?", firmaValida);

  // 6. Intentar verificar con datos modificados
  const datosModificados = Buffer.from("Documento modificado", "utf-8");
  const hashModificado = hash(datosModificados);
  const firmaValidaModificada = verify(firma, hashModificado, publicKey);
  console.log("¿Firma válida con datos modificados?", firmaValidaModificada);
}

// ============================================
// EJEMPLO 5: Flujo completo de transferencia segura
// ============================================
function ejemploFlujoCompleto() {
  console.log("\n=== EJEMPLO 5: Flujo Completo de Transferencia Segura ===\n");

  // === EMISOR ===
  console.log("--- EMISOR ---");

  // 1. Generar par de claves del emisor
  const { publicKey: emisorPublic, privateKey: emisorPrivate } =
    generateKeyPair();

  // 2. Archivo a enviar
  const archivo = Buffer.from("Contenido confidencial del archivo", "utf-8");
  console.log("Archivo original:", archivo.toString("utf-8"));

  // 3. Generar hash del archivo
  const hashArchivo = hash(archivo);
  console.log("Hash del archivo:", hashArchivo);

  // 4. Firmar hash
  const firmaArchivo = sign(hashArchivo, emisorPrivate);
  console.log(
    "Firma generada:",
    bufferToBase64(firmaArchivo).substring(0, 50) + "..."
  );

  // 5. Generar clave de sesión
  const sessionKey = generateSessionKey();

  // 6. Cifrar archivo con AES
  const archivoCifrado = aesEncrypt(archivo, sessionKey);
  console.log(
    "Archivo cifrado:",
    bufferToBase64(archivoCifrado.ciphertext).substring(0, 50) + "..."
  );

  // === RECEPTOR ===
  console.log("\n--- RECEPTOR ---");

  // 7. Generar par de claves del receptor
  const { publicKey: receptorPublic, privateKey: receptorPrivate } =
    generateKeyPair();

  // 8. Cifrar clave de sesión con clave pública del receptor
  const sessionKeyCifrada = encryptWithPublicKey(sessionKey, receptorPublic);
  console.log(
    "Clave de sesión cifrada:",
    bufferToBase64(sessionKeyCifrada).substring(0, 50) + "..."
  );

  // === TRANSFERENCIA ===
  console.log("\n--- TRANSFERENCIA ---");
  console.log("Se envía:");
  console.log("  - Archivo cifrado");
  console.log("  - IV y AuthTag");
  console.log("  - Clave de sesión cifrada con RSA");
  console.log("  - Firma digital del hash");
  console.log("  - Clave pública del emisor");

  // === RECEPTOR DESCIFRA ===
  console.log("\n--- RECEPTOR DESCIFRA ---");

  // 9. Descifrar clave de sesión con clave privada del receptor
  const sessionKeyDescifrada = decryptWithPrivateKey(
    sessionKeyCifrada,
    receptorPrivate
  );
  console.log(
    "Clave de sesión descifrada:",
    bufferToBase64(sessionKeyDescifrada)
  );

  // 10. Descifrar archivo con clave de sesión
  const archivoDescifrado = aesDecrypt(
    archivoCifrado.ciphertext,
    sessionKeyDescifrada,
    archivoCifrado.iv,
    archivoCifrado.authTag
  );
  console.log("Archivo descifrado:", archivoDescifrado.toString("utf-8"));

  // 11. Verificar integridad
  const hashArchivoDescifrado = hash(archivoDescifrado);
  console.log("Hash del archivo descifrado:", hashArchivoDescifrado);

  // 12. Verificar firma
  const firmaValida = verify(firmaArchivo, hashArchivoDescifrado, emisorPublic);
  console.log("¿Firma válida?", firmaValida);
  console.log(
    "¿Integridad verificada?",
    hashArchivo === hashArchivoDescifrado && firmaValida
  );
}

// Ejecutar ejemplos (descomentar para usar)
// ejemploCifradoSimetrico();
// ejemploCifradoArchivo();
// ejemploCifradoAsimetrico();
// ejemploHashYFirma();
// ejemploFlujoCompleto();

export {
  ejemploCifradoSimetrico,
  ejemploCifradoArchivo,
  ejemploCifradoAsimetrico,
  ejemploHashYFirma,
  ejemploFlujoCompleto,
};
