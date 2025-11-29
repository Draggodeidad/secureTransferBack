/**
 * Script para generar un par de claves RSA
 * Uso: npm run generate:keys
 */

import { generateKeyPair } from "./services/cryptoService.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const KEYS_DIR = "keys";

// Crear directorio keys/ si no existe
if (!existsSync(KEYS_DIR)) {
  mkdirSync(KEYS_DIR, { mode: 0o700 });
  console.log(`✓ Directorio '${KEYS_DIR}/' creado con permisos restrictivos`);
}

// Generar par de claves
console.log("\n🔐 Generando par de claves RSA-2048...");
const { publicKey, privateKey } = generateKeyPair();

// Guardar claves
const timestamp = Date.now();
const publicKeyPath = join(KEYS_DIR, `public_${timestamp}.pem`);
const privateKeyPath = join(KEYS_DIR, `private_${timestamp}.pem`);

writeFileSync(publicKeyPath, publicKey);
writeFileSync(privateKeyPath, privateKey, { mode: 0o400 }); // Solo lectura

console.log("✓ Par de claves generado exitosamente!\n");
console.log(`📄 Clave pública guardada en: ${publicKeyPath}`);
console.log(`🔒 Clave privada guardada en: ${privateKeyPath}`);
console.log("\n⚠️  IMPORTANTE:");
console.log("   - La clave privada tiene permisos de solo lectura (400)");
console.log("   - NO compartas la clave privada con nadie");
console.log("   - Guarda la clave privada en un lugar seguro");
console.log(
  "   - En producción, usa variables de entorno o un gestor de secretos\n"
);

console.log("💡 Para usar estas claves en tu aplicación:");
console.log(`   export PUBLIC_KEY="$(cat ${publicKeyPath})"`);
console.log(`   export PRIVATE_KEY="$(cat ${privateKeyPath})"\n`);
