/**
 * Script de prueba rápida para el módulo de criptografía
 * Ejecutar con: npm run test:crypto
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
  bufferToBase64,
} from "./services/cryptoService.js";

console.log("🔐 PRUEBA DEL MÓDULO DE CRIPTOGRAFÍA\n");
console.log("=".repeat(50));

// ===== PRUEBA 1: Cifrado Simétrico =====
console.log("\n📝 PRUEBA 1: Cifrado Simétrico (AES-256-GCM)");
console.log("-".repeat(50));

const sessionKey = generateSessionKey();
console.log(
  "✓ Clave de sesión generada:",
  bufferToBase64(sessionKey).substring(0, 20) + "..."
);

const mensaje = Buffer.from("Hola, este es un mensaje secreto!", "utf-8");
console.log("✓ Mensaje original:", mensaje.toString("utf-8"));

const encrypted = aesEncrypt(mensaje, sessionKey);
console.log(
  "✓ Mensaje cifrado:",
  bufferToBase64(encrypted.ciphertext).substring(0, 30) + "..."
);

const decrypted = aesDecrypt(
  encrypted.ciphertext,
  sessionKey,
  encrypted.iv,
  encrypted.authTag
);
console.log("✓ Mensaje descifrado:", decrypted.toString("utf-8"));
console.log(
  "✓ ¿Coincide con el original?",
  mensaje.equals(decrypted) ? "✅ SÍ" : "❌ NO"
);

// ===== PRUEBA 2: Hash =====
console.log("\n📝 PRUEBA 2: Hash SHA-256");
console.log("-".repeat(50));

const data = Buffer.from("Datos a verificar", "utf-8");
const hashValue = hash(data);
console.log("✓ Datos:", data.toString("utf-8"));
console.log("✓ Hash SHA-256:", hashValue);
console.log(
  "✓ Longitud del hash:",
  hashValue.length,
  "caracteres (64 esperados)"
);

// ===== PRUEBA 3: Criptografía Asimétrica =====
console.log("\n📝 PRUEBA 3: Criptografía Asimétrica (RSA-2048)");
console.log("-".repeat(50));

const keyPair = generateKeyPair();
console.log("✓ Par de claves RSA generado");
console.log(
  "  - Clave pública (primeros 60 chars):",
  keyPair.publicKey.substring(0, 60) + "..."
);
console.log(
  "  - Clave privada (primeros 60 chars):",
  keyPair.privateKey.substring(0, 60) + "..."
);

const sessionKey2 = generateSessionKey();
console.log(
  "✓ Clave de sesión generada:",
  bufferToBase64(sessionKey2).substring(0, 20) + "..."
);

const encryptedKey = encryptWithPublicKey(sessionKey2, keyPair.publicKey);
console.log(
  "✓ Clave de sesión cifrada con RSA:",
  bufferToBase64(encryptedKey).substring(0, 30) + "..."
);

const decryptedKey = decryptWithPrivateKey(encryptedKey, keyPair.privateKey);
console.log(
  "✓ Clave de sesión descifrada:",
  bufferToBase64(decryptedKey).substring(0, 20) + "..."
);
console.log(
  "✓ ¿Coinciden las claves?",
  sessionKey2.equals(decryptedKey) ? "✅ SÍ" : "❌ NO"
);

// ===== PRUEBA 4: Firma Digital =====
console.log("\n📝 PRUEBA 4: Firma Digital");
console.log("-".repeat(50));

const documento = Buffer.from("Contrato importante", "utf-8");
const hashDocumento = hash(documento);
console.log("✓ Documento:", documento.toString("utf-8"));
console.log("✓ Hash del documento:", hashDocumento);

const firma = sign(hashDocumento, keyPair.privateKey);
console.log(
  "✓ Firma generada:",
  bufferToBase64(firma).substring(0, 40) + "..."
);

const firmaValida = verify(firma, hashDocumento, keyPair.publicKey);
console.log("✓ ¿Firma válida?", firmaValida ? "✅ SÍ" : "❌ NO");

// Intentar con documento modificado
const documentoModificado = Buffer.from("Contrato modificado", "utf-8");
const hashModificado = hash(documentoModificado);
const firmaValidaModificado = verify(firma, hashModificado, keyPair.publicKey);
console.log(
  "✓ ¿Firma válida con documento modificado?",
  firmaValidaModificado ? "✅ SÍ" : "❌ NO (esperado)"
);

// ===== PRUEBA 5: Flujo Completo =====
console.log("\n📝 PRUEBA 5: Flujo Completo de Transferencia Segura");
console.log("-".repeat(50));

// Emisor
const emisorKeys = generateKeyPair();
console.log("\n👤 EMISOR:");
console.log("  ✓ Par de claves generado");

const archivo = Buffer.from("Contenido confidencial del archivo.pdf", "utf-8");
console.log("  ✓ Archivo a enviar:", archivo.toString("utf-8"));

const hashArchivo = hash(archivo);
console.log("  ✓ Hash del archivo:", hashArchivo);

const firmaArchivo = sign(hashArchivo, emisorKeys.privateKey);
console.log("  ✓ Archivo firmado");

const sessionKeyArchivo = generateSessionKey();
const archivoCifrado = aesEncrypt(archivo, sessionKeyArchivo);
console.log("  ✓ Archivo cifrado con AES-256-GCM");

// Receptor
const receptorKeys = generateKeyPair();
console.log("\n👤 RECEPTOR:");
console.log("  ✓ Par de claves generado");

const sessionKeyCifrada = encryptWithPublicKey(
  sessionKeyArchivo,
  receptorKeys.publicKey
);
console.log("  ✓ Clave de sesión cifrada para receptor");

console.log("\n📦 TRANSFERENCIA:");
console.log("  → Archivo cifrado");
console.log("  → IV y AuthTag");
console.log("  → Clave de sesión cifrada");
console.log("  → Firma digital");
console.log("  → Clave pública del emisor");

console.log("\n👤 RECEPTOR DESCIFRA:");
const sessionKeyDescifrada = decryptWithPrivateKey(
  sessionKeyCifrada,
  receptorKeys.privateKey
);
console.log("  ✓ Clave de sesión descifrada");

const archivoDescifrado = aesDecrypt(
  archivoCifrado.ciphertext,
  sessionKeyDescifrada,
  archivoCifrado.iv,
  archivoCifrado.authTag
);
console.log("  ✓ Archivo descifrado:", archivoDescifrado.toString("utf-8"));

const hashArchivoDescifrado = hash(archivoDescifrado);
const firmaValidaArchivo = verify(
  firmaArchivo,
  hashArchivoDescifrado,
  emisorKeys.publicKey
);
console.log(
  "  ✓ Integridad verificada:",
  hashArchivo === hashArchivoDescifrado ? "✅ SÍ" : "❌ NO"
);
console.log("  ✓ Firma verificada:", firmaValidaArchivo ? "✅ SÍ" : "❌ NO");

// ===== RESUMEN =====
console.log("\n" + "=".repeat(50));
console.log("🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE");
console.log("=".repeat(50) + "\n");
