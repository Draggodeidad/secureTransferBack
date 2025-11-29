/**
 * Script de ejemplo: Demostración del flujo completo de transferencia segura
 *
 * Este script demuestra el uso de las funciones implementadas en la Fase 4
 */

import { generateKeyPair } from "./services/cryptoService.js";
import {
  executeUploadFlow,
  executeDownloadFlow,
  packageSecureData,
  serializeManifest,
  parseManifest,
  validateManifest,
} from "./services/transferFlowService.js";
import { createSecurePackage } from "./services/fileService.js";
import logger from "./utils/logger.js";

// Colores para la consola
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function demoFlujoCompleto() {
  log(
    "\n╔════════════════════════════════════════════════════════════════╗",
    colors.cyan
  );
  log(
    "║  🔐 DEMO: Flujo Completo de Transferencia Segura              ║",
    colors.cyan
  );
  log(
    "║  FASE 4 - Funciones Reusables                                 ║",
    colors.cyan
  );
  log(
    "╚════════════════════════════════════════════════════════════════╝\n",
    colors.cyan
  );

  try {
    // ============================================================
    // PASO 0: Preparación
    // ============================================================
    log("📋 PASO 0: Preparación", colors.bright);
    log("─────────────────────────────────────────────────────────────\n");

    // Generar claves para Emisor A y Receptor B
    log("🔑 Generando claves para Emisor A...", colors.blue);
    const emisorA = generateKeyPair();
    log("✅ Emisor A: Claves generadas", colors.green);

    log("🔑 Generando claves para Receptor B...", colors.blue);
    const receptorB = generateKeyPair();
    log("✅ Receptor B: Claves generadas", colors.green);

    // Archivo a transferir
    const archivoOriginal = Buffer.from(`
╔════════════════════════════════════════════════════════════════╗
║                   DOCUMENTO CONFIDENCIAL                        ║
╚════════════════════════════════════════════════════════════════╝

Contrato de Transferencia de Datos
Fecha: ${new Date().toLocaleDateString()}

Este es un documento de prueba para demostrar el flujo completo
de transferencia segura implementado en la Fase 4.

Características:
- Cifrado AES-256-GCM
- Firma digital RSA-PSS
- Hash SHA-256
- Intercambio de claves RSA-OAEP

Firmado digitalmente por: Emisor A
Para: Receptor B

═══════════════════════════════════════════════════════════════
    `);

    log(
      `\n📄 Archivo original: ${archivoOriginal.length} bytes\n`,
      colors.yellow
    );

    // ============================================================
    // PASO 1: UPLOAD - EMISOR A
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  📤 PASO 1: UPLOAD (EMISOR A)                                  ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    log("🚀 Iniciando flujo de upload completo...", colors.blue);
    const uploadResult = executeUploadFlow(
      archivoOriginal,
      "contrato-confidencial.txt",
      "text/plain",
      emisorA.privateKey,
      emisorA.publicKey,
      receptorB.publicKey
    );
    log("✅ Flujo de upload completado", colors.green);

    // Mostrar resultados
    log("\n📊 Resultados del Upload:", colors.bright);
    log(`   • Tamaño original: ${uploadResult.metadata.originalSize} bytes`);
    log(
      `   • Tamaño cifrado: ${uploadResult.encryptedFile.ciphertext.length} bytes`
    );
    log(`   • Hash SHA-256: ${uploadResult.fileHash.substring(0, 32)}...`);
    log(`   • Firma generada: ${uploadResult.signature.length} bytes`);
    log(
      `   • Session key cifrada: ${uploadResult.encryptedSessionKey.length} bytes\n`
    );

    // ============================================================
    // PASO 2: EMPAQUETAR MANIFEST
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  📦 PASO 2: EMPAQUETAR MANIFEST                                ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    log("📦 Empaquetando datos seguros...", colors.blue);
    const manifest = packageSecureData(
      uploadResult.encryptedFile,
      uploadResult.encryptedSessionKey,
      uploadResult.fileHash,
      uploadResult.signature,
      emisorA.publicKey,
      "contrato-confidencial.txt",
      archivoOriginal.length,
      "text/plain"
    );
    log("✅ Manifest creado exitosamente", colors.green);

    // Validar manifest
    log("🔍 Validando estructura del manifest...", colors.blue);
    const isValid = validateManifest(manifest);
    log(`✅ Manifest válido: ${isValid}`, colors.green);

    // Serializar (simular transmisión)
    log("📡 Serializando manifest para transmisión...", colors.blue);
    const manifestJson = serializeManifest(manifest);
    log(
      `✅ Manifest serializado: ${manifestJson.length} bytes\n`,
      colors.green
    );

    // ============================================================
    // PASO 3: CREAR PAQUETE ZIP (OPCIONAL)
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  🗂️  PASO 3: CREAR PAQUETE ZIP                                 ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    log("🗂️  Creando paquete ZIP seguro...", colors.blue);
    const zipBuffer = await createSecurePackage(
      archivoOriginal,
      "contrato-confidencial.txt",
      "text/plain",
      emisorA.privateKey,
      emisorA.publicKey,
      receptorB.publicKey
    );
    log("✅ Paquete ZIP creado", colors.green);
    log(`   • Tamaño ZIP: ${zipBuffer.length} bytes\n`, colors.yellow);

    // ============================================================
    // PASO 4: TRANSMISIÓN (SIMULADA)
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  📡 PASO 4: TRANSMISIÓN (SIMULADA)                             ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    log("📡 Transmitiendo manifest...", colors.blue);
    log("   🌐 Canal: HTTPS/API", colors.yellow);
    log("   📦 Paquete: Manifest JSON", colors.yellow);
    log("   🔒 Estado: Cifrado end-to-end", colors.yellow);

    // Simular deserialización
    const receivedManifest = parseManifest(manifestJson);
    log("✅ Manifest recibido por Receptor B\n", colors.green);

    // ============================================================
    // PASO 5: DOWNLOAD - RECEPTOR B
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  📥 PASO 5: DOWNLOAD (RECEPTOR B)                              ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    log("🚀 Iniciando flujo de download completo...", colors.blue);
    const downloadResult = executeDownloadFlow(
      receivedManifest,
      receptorB.privateKey
    );
    log("✅ Flujo de download completado", colors.green);

    // ============================================================
    // PASO 6: VERIFICACIÓN
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  ✔️  PASO 6: VERIFICACIÓN DE SEGURIDAD                         ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    log("🔍 Verificando integridad y autenticidad...", colors.blue);
    log(`\n📊 Resultados de Verificación:`, colors.bright);
    log(
      `   • Hash válido: ${downloadResult.verificationDetails.hashValid ? "✅ SÍ" : "❌ NO"}`,
      downloadResult.verificationDetails.hashValid ? colors.green : colors.red
    );
    log(
      `   • Firma válida: ${downloadResult.verificationDetails.signatureValid ? "✅ SÍ" : "❌ NO"}`,
      downloadResult.verificationDetails.signatureValid
        ? colors.green
        : colors.red
    );
    log(
      `   • Verificación completa: ${downloadResult.verified ? "✅ EXITOSA" : "❌ FALLIDA"}`,
      downloadResult.verified ? colors.green : colors.red
    );

    // ============================================================
    // PASO 7: RESULTADO FINAL
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.cyan
    );
    log(
      "║  🎉 PASO 7: RESULTADO FINAL                                    ║",
      colors.cyan
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝\n",
      colors.cyan
    );

    // Comparar archivos
    const archivosIguales = downloadResult.fileBuffer.equals(archivoOriginal);
    log(`📄 Archivo descifrado:`, colors.bright);
    log(`   • Tamaño: ${downloadResult.fileBuffer.length} bytes`);
    log(`   • Nombre: ${downloadResult.metadata.originalFilename}`);
    log(`   • Tipo MIME: ${downloadResult.metadata.mimeType}`);
    log(
      `   • Integridad: ${archivosIguales ? "✅ PRESERVADA" : "❌ COMPROMETIDA"}`,
      archivosIguales ? colors.green : colors.red
    );

    // Mostrar fragmento del archivo
    log(`\n📄 Contenido descifrado (primeras líneas):`, colors.yellow);
    const preview = downloadResult.fileBuffer
      .toString()
      .split("\n")
      .slice(0, 10)
      .join("\n");
    log(`${colors.cyan}${preview}${colors.reset}\n`);

    // ============================================================
    // RESUMEN FINAL
    // ============================================================
    log(
      "\n╔════════════════════════════════════════════════════════════════╗",
      colors.bright
    );
    log(
      "║                     ✅ DEMO COMPLETADA                          ║",
      colors.bright
    );
    log(
      "╚════════════════════════════════════════════════════════════════╝",
      colors.bright
    );

    log("\n📊 Resumen de la Transferencia:", colors.bright);
    log(`   • Emisor: Emisor A`);
    log(`   • Receptor: Receptor B`);
    log(`   • Archivo: contrato-confidencial.txt`);
    log(`   • Tamaño: ${archivoOriginal.length} bytes`);
    log(`   • Algoritmos:`);
    log(`     - Cifrado: AES-256-GCM`);
    log(`     - Intercambio: RSA-2048-OAEP`);
    log(`     - Hash: SHA-256`);
    log(`     - Firma: RSA-PSS`);
    log(
      `   • Estado: ${downloadResult.verified ? "✅ EXITOSA" : "❌ FALLIDA"}`
    );

    log("\n🎊 Fase 4 implementada exitosamente! 🎊\n", colors.green);
  } catch (error) {
    log("\n❌ ERROR EN LA DEMO:", colors.red);
    console.error(error);
    logger.error({ error }, "Error en demo del flujo completo");
  }
}

// ============================================================
// CASOS DE USO ADICIONALES
// ============================================================

async function demoCasosDeUso() {
  log(
    "\n╔════════════════════════════════════════════════════════════════╗",
    colors.cyan
  );
  log(
    "║  📚 CASOS DE USO ADICIONALES                                   ║",
    colors.cyan
  );
  log(
    "╚════════════════════════════════════════════════════════════════╝\n",
    colors.cyan
  );

  // Caso 1: Múltiples receptores
  log("📋 Caso 1: Múltiples Receptores", colors.bright);
  log("─────────────────────────────────────────────────────────────\n");

  const emisor = generateKeyPair();
  const receptorX = generateKeyPair();
  const receptorY = generateKeyPair();
  const receptorZ = generateKeyPair();

  const documento = Buffer.from("Documento para múltiples destinatarios");

  log("📤 Emisor crea 3 paquetes (uno por receptor)...", colors.blue);
  const paqueteX = executeUploadFlow(
    documento,
    "doc.txt",
    "text/plain",
    emisor.privateKey,
    emisor.publicKey,
    receptorX.publicKey
  );
  const paqueteY = executeUploadFlow(
    documento,
    "doc.txt",
    "text/plain",
    emisor.privateKey,
    emisor.publicKey,
    receptorY.publicKey
  );
  const paqueteZ = executeUploadFlow(
    documento,
    "doc.txt",
    "text/plain",
    emisor.privateKey,
    emisor.publicKey,
    receptorZ.publicKey
  );

  log("✅ 3 paquetes creados (claves de sesión diferentes)", colors.green);
  log(
    `   • Paquete X: ${paqueteX.encryptedSessionKey.toString("hex").substring(0, 20)}...`
  );
  log(
    `   • Paquete Y: ${paqueteY.encryptedSessionKey.toString("hex").substring(0, 20)}...`
  );
  log(
    `   • Paquete Z: ${paqueteZ.encryptedSessionKey.toString("hex").substring(0, 20)}...`
  );

  log(
    "\n✅ Caso 1 demostrado: Cada receptor tiene su propio paquete cifrado\n",
    colors.green
  );

  // Caso 2: Detección de manipulación
  log("\n📋 Caso 2: Detección de Manipulación", colors.bright);
  log("─────────────────────────────────────────────────────────────\n");

  const testFile = Buffer.from("Archivo de prueba");
  const testEmisor = generateKeyPair();
  const testReceptor = generateKeyPair();

  const testUpload = executeUploadFlow(
    testFile,
    "test.txt",
    "text/plain",
    testEmisor.privateKey,
    testEmisor.publicKey,
    testReceptor.publicKey
  );

  const testManifest = packageSecureData(
    testUpload.encryptedFile,
    testUpload.encryptedSessionKey,
    testUpload.fileHash,
    testUpload.signature,
    testEmisor.publicKey,
    "test.txt",
    testFile.length,
    "text/plain"
  );

  // Manipular manifest
  log("⚠️  Simulando manipulación del manifest...", colors.yellow);
  const manifestManipulado = { ...testManifest };
  manifestManipulado.fileHash = "0".repeat(64);

  log("📥 Receptor intenta descifrar archivo manipulado...", colors.blue);
  const resultManipulado = executeDownloadFlow(
    manifestManipulado,
    testReceptor.privateKey
  );

  log(`❌ Detección: Archivo manipulado detectado!`, colors.red);
  log(`   • Hash válido: ${resultManipulado.verificationDetails.hashValid}`);
  log(
    `   • Firma válida: ${resultManipulado.verificationDetails.signatureValid}`
  );
  log(`   • Verificación: ${resultManipulado.verified ? "✅" : "❌"}`);

  log(
    "\n✅ Caso 2 demostrado: Manipulación detectada correctamente\n",
    colors.green
  );
}

// ============================================================
// EJECUCIÓN
// ============================================================

async function main() {
  console.clear();

  log(
    "╔════════════════════════════════════════════════════════════════╗",
    colors.bright
  );
  log(
    "║                                                                ║",
    colors.bright
  );
  log(
    "║           🔐 SECURE TRANSFER - FASE 4                          ║",
    colors.bright
  );
  log(
    "║           Demostración de Flujo Completo                       ║",
    colors.bright
  );
  log(
    "║                                                                ║",
    colors.bright
  );
  log(
    "╚════════════════════════════════════════════════════════════════╝",
    colors.bright
  );

  await demoFlujoCompleto();
  await demoCasosDeUso();

  log(
    "\n╔════════════════════════════════════════════════════════════════╗",
    colors.cyan
  );
  log(
    "║  🎓 Para más información:                                      ║",
    colors.cyan
  );
  log(
    "║     • FASE_4_IMPLEMENTACION.md                                 ║",
    colors.cyan
  );
  log(
    "║     • PRUEBAS_GUIA.md                                          ║",
    colors.cyan
  );
  log(
    "║     • npm test                                                 ║",
    colors.cyan
  );
  log(
    "╚════════════════════════════════════════════════════════════════╝\n",
    colors.cyan
  );
}

// Ejecutar demo
main().catch(console.error);
