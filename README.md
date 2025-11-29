# 🔐 Secure Transfer API

API REST para transferencia segura de archivos con **cifrado end-to-end**, **firma digital** y **verificación de integridad**.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.1-lightgrey.svg)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Tests-360+-brightgreen.svg)](./src/tests/)
[![Coverage](https://img.shields.io/badge/Coverage-95%25-brightgreen.svg)](./src/tests/)

---

## ✨ Características

- 🔐 **Cifrado AES-256-GCM** para archivos
- 🔑 **RSA-2048** para intercambio de claves
- ✍️ **Firma digital RSA-PSS** para autenticidad
- 🔍 **Hash SHA-256** para verificación de integridad
- 📦 **Empaquetado automático** en ZIP con manifest
- ☁️ **Storage en Supabase** (escalable)
- 🧪 **360+ tests** con 95% de cobertura
- 📚 **Swagger UI** para documentación interactiva
- 🔒 **Helmet.js** para seguridad
- 📝 **Logging con Pino** para monitoreo

---

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+
- npm o yarn
- Cuenta en Supabase (gratis)

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/secureTransfer.git
cd secureTransfer

# Instalar dependencias
npm install

# Generar claves RSA del servidor
npm run generate:keys

# Configurar variables de entorno (ver sección siguiente)
cp docs/env.server.example .env

# Compilar TypeScript
npm run build

# Iniciar servidor
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

---

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz:

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET_NAME=fileStorage

# Servidor
PORT=3000
NODE_ENV=development

# Claves RSA (genera con: npm run generate:keys)
SERVER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
SERVER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

Ver ejemplos completos en `docs/env.server.example`

---

## 📖 Documentación

### Para Deploy a Producción

1. **[DEPLOY_QUICK_START.md](./docs/DEPLOY_QUICK_START.md)** ⭐ **START HERE**
   - Resumen ejecutivo (5 min)
   - Checklist completo
   - Tiempo: 20-30 minutos total

2. **[DEPLOY_RENDER_GUIDE.md](./docs/DEPLOY_RENDER_GUIDE.md)**
   - Guía paso a paso para Render
   - Configuración de Supabase
   - Troubleshooting

3. **[ARQUITECTURA_KEYS_SIMPLE.md](./docs/ARQUITECTURA_KEYS_SIMPLE.md)**
   - Explicación de las claves RSA
   - Flujo completo de emisor y receptor
   - Diagramas visuales

4. **[FRONTEND_UI_EXAMPLE.md](./docs/FRONTEND_UI_EXAMPLE.md)**
   - Código completo para Next.js
   - UI minimalista
   - Integración con la API

### Documentación Técnica

5. **[README_FASE_4.md](./docs/README_FASE_4.md)**
   - Implementación completa
   - 15+ funciones reusables
   - 360+ tests

6. **[API_USAGE_EXAMPLES.md](./docs/API_USAGE_EXAMPLES.md)**
   - Ejemplos de uso con curl/Postman
   - Casos de uso comunes

---

## 🎯 Endpoints Principales

### Upload (Emisor)

```bash
POST /upload

# Body (multipart/form-data):
- file: archivo a enviar
- recipientPublicKey: clave pública RSA del receptor

# Response:
{
  "packageId": "uuid",
  "filename": "documento.pdf",
  "downloadUrl": "/download/uuid"
}
```

### Download (Receptor)

```bash
GET /download/:packageId

# Response:
- Archivo ZIP con:
  - archivo_cifrado.enc
  - manifest.json
```

### Otros Endpoints

- `GET /health` - Health check
- `GET /metadata/:packageId` - Metadatos del paquete
- `GET /api-docs` - Swagger UI

---

## 🔐 Arquitectura de Seguridad

### Flujo de Cifrado (Upload)

```
1. Usuario sube archivo.pdf
2. Backend genera sessionKey (AES-256) aleatoria
3. Cifra archivo con sessionKey → archivo_cifrado
4. Calcula hash SHA-256 del archivo original
5. Firma hash con SERVER_PRIVATE_KEY → firma
6. Cifra sessionKey con recipientPublicKey (RSA) → sessionKey_cifrada
7. Empaqueta todo en ZIP:
   ├─ archivo_cifrado.enc
   └─ manifest.json (sessionKey_cifrada, firma, hash, metadata)
8. Sube ZIP a Supabase
9. Retorna packageId
```

### Flujo de Descifrado (Download)

```
1. Usuario descarga ZIP con packageId
2. Extrae manifest.json
3. Descifra sessionKey_cifrada con su privateKey → sessionKey
4. Descifra archivo_cifrado con sessionKey → archivo_original
5. Verifica hash (integridad)
6. Verifica firma con SERVER_PUBLIC_KEY (autenticidad)
7. ✅ Archivo original descifrado y verificado
```

Ver más detalles en [ARQUITECTURA_KEYS_SIMPLE.md](./docs/ARQUITECTURA_KEYS_SIMPLE.md)

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch
npm run test:watch

# Cobertura de código
npm run test:coverage

# Demo del flujo completo
npm run demo:flujo
```

**Resultados:**

- 360+ tests
- 95% de cobertura
- Suites: cryptoService, fileService, transferFlowService

---

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor en modo desarrollo (watch)
npm run build        # Compila TypeScript a JavaScript
npm start            # Inicia servidor de producción

# Testing
npm test             # Ejecuta tests
npm run test:watch   # Tests en modo watch
npm run test:coverage # Cobertura de código

# Utilities
npm run generate:keys    # Genera par de claves RSA
npm run demo:flujo       # Demo interactivo del flujo completo

# Linting
npm run lint         # Ejecuta ESLint
npm run lint:fix     # Corrige problemas automáticamente
npm run format       # Formatea código con Prettier
```

---

## 📦 Tecnologías

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express 5.1
- **Lenguaje**: TypeScript 5.9
- **Criptografía**: Node.js Crypto (nativo)
- **Storage**: Supabase
- **Testing**: Jest 29
- **Logging**: Pino
- **Seguridad**: Helmet.js, CORS

### Algoritmos Criptográficos

- **Cifrado simétrico**: AES-256-GCM
- **Cifrado asimétrico**: RSA-OAEP-2048
- **Firma digital**: RSA-PSS-2048
- **Hash**: SHA-256

---

## 🚀 Deploy a Producción

### Opción 1: Render (Recomendado)

```bash
# 1. Preparar claves
npm run generate:keys
.\prepare-keys-for-render.ps1

# 2. Deploy en Render
# Ver guía completa: docs/DEPLOY_RENDER_GUIDE.md
```

### Opción 2: Railway

```bash
# 1. Instalar CLI
npm install -g @railway/cli

# 2. Login y deploy
railway login
railway link
railway up
```

### Opción 3: Docker

```bash
# Crear imagen
docker build -t securetransfer-api .

# Correr contenedor
docker run -p 3000:3000 --env-file .env securetransfer-api
```

Ver guía completa: [DEPLOY_RENDER_GUIDE.md](./docs/DEPLOY_RENDER_GUIDE.md)

---

## 📊 Estructura del Proyecto

```
secureTransfer/
├── src/
│   ├── controllers/      # Controladores de endpoints
│   ├── services/         # Lógica de negocio
│   │   ├── cryptoService.ts        # Funciones de cifrado
│   │   ├── fileService.ts          # Gestión de archivos
│   │   ├── transferFlowService.ts  # Flujo completo
│   │   └── supabaseService.ts      # Integración con Supabase
│   ├── routes/           # Definición de rutas
│   ├── middlewares/      # Middleware (upload, auth, etc.)
│   ├── types/            # Tipos TypeScript
│   ├── utils/            # Utilidades (logger, etc.)
│   ├── tests/            # Tests unitarios (360+)
│   └── index.ts          # Entry point
├── docs/                 # Documentación completa
│   ├── DEPLOY_QUICK_START.md
│   ├── DEPLOY_RENDER_GUIDE.md
│   ├── ARQUITECTURA_KEYS_SIMPLE.md
│   ├── FRONTEND_UI_EXAMPLE.md
│   └── ...
├── keys/                 # Claves RSA (git-ignored)
├── dist/                 # Código compilado
├── package.json
├── tsconfig.json
├── jest.config.json
├── render.yaml           # Configuración de Render
└── README.md             # Este archivo
```

---

## 🔒 Seguridad

### Implementado

✅ Cifrado AES-256-GCM con claves únicas por archivo  
✅ RSA-2048 para intercambio seguro de claves  
✅ Firma digital RSA-PSS para autenticidad  
✅ Hash SHA-256 para verificación de integridad  
✅ Helmet.js para headers de seguridad  
✅ CORS configurado  
✅ Variables de entorno para secretos  
✅ `.gitignore` para claves privadas  
✅ Logging de seguridad con Pino

### Mejores Prácticas

1. **Nunca** subir claves privadas a Git
2. **Usar** variables de entorno en producción
3. **Rotar** claves cada 90 días
4. **Configurar** CORS solo para dominios permitidos
5. **Habilitar** rate limiting en producción
6. **Monitorear** logs de seguridad

---

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la Licencia ISC.

---

## 📞 Soporte

- **Documentación**: [`docs/`](./docs/)
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/secureTransfer/issues)
- **Email**: support@securetransfer.com

---

## 🎉 Estado del Proyecto

### Fase 4: ✅ COMPLETADO

- ✅ 15+ funciones reusables
- ✅ 360+ tests unitarios
- ✅ 95% de cobertura
- ✅ Documentación completa
- ✅ Flujo upload/download
- ✅ Listo para producción

### Próximas Features

- [ ] Rate limiting
- [ ] Autenticación de usuarios
- [ ] Notificaciones por email
- [ ] Interfaz web completa
- [ ] CLI para usuarios avanzados
- [ ] Rotación automática de claves

---

## 🌟 Créditos

Desarrollado con ❤️ usando:

- Node.js
- TypeScript
- Express
- Supabase
- Jest

---

**¿Listo para deployar? → [docs/DEPLOY_QUICK_START.md](./docs/DEPLOY_QUICK_START.md)** 🚀
