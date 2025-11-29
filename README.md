# 🔐 Secure Transfer API

API REST para transferencia segura de archivos con cifrado de extremo a extremo.

## 📋 Descripción

**Secure Transfer** es una API robusta diseñada para permitir la transferencia segura de archivos entre usuarios mediante cifrado de extremo a extremo. El sistema gestiona la subida, almacenamiento temporal, descarga y descifrado de archivos, así como la administración de llaves públicas de usuarios.

## ✨ Características

- ✅ **Subida de archivos** con cifrado automático
- ✅ **Gestión de llaves públicas** de usuarios
- ✅ **Descarga segura** de paquetes cifrados
- ✅ **Descifrado** de archivos con llave privada
- ✅ **Metadatos completos** de cada paquete
- ✅ **Expiración automática** de paquetes (7 días)
- ✅ **Documentación Swagger** interactiva
- ✅ **Límite de tamaño** de archivos (50 MB)
- ✅ **Almacenamiento en Supabase** Storage
- ✅ **Seguridad HTTP** con Helmet
- ✅ **CORS** habilitado
- ✅ **Logging** con Pino

## 🏗️ Arquitectura

```
secureTransfer/
├── src/
│   ├── controllers/        # Lógica de negocio de los endpoints
│   │   ├── fileController.ts
│   │   └── keysController.ts
│   ├── middlewares/        # Middlewares personalizados
│   │   └── upload.ts       # Configuración de Multer
│   ├── routes/             # Definición de rutas y JSDoc
│   │   ├── fileRoutes.ts
│   │   └── keysRoutes.ts
│   ├── services/           # Servicios (placeholder)
│   │   ├── cryptoService.ts
│   │   └── fileService.ts
│   ├── types/              # Tipos e interfaces TypeScript
│   │   └── index.ts
│   ├── utils/              # Utilidades
│   │   └── logger.ts
│   └── index.ts            # Punto de entrada de la aplicación
├── dist/                   # Código compilado
├── uploads/                # Archivos subidos (no en Git)
├── API_DOCUMENTATION.md    # Documentación detallada de la API
├── EXAMPLES.md             # Ejemplos de uso
├── package.json
└── tsconfig.json
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js >= 18.x
- npm >= 9.x

### Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd secureTransfer

# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.example .env
```

### Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET_NAME=fileStorage
```

📖 **Para configurar Supabase**, consulta la [Guía de Configuración de Supabase](./SUPABASE_SETUP.md)

### Ejecución

```bash
# Modo desarrollo (con hot-reload)
npm run dev

# Compilar TypeScript
npm run build

# Modo producción
npm start

# Linting
npm run lint
npm run lint:fix

# Formateo
npm run format
npm run format:check
```

## 📚 Documentación

### Swagger UI

Una vez iniciado el servidor, accede a la documentación interactiva:

```
http://localhost:3000/api-docs
```

### Documentación Completa

Consulta [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) para una documentación detallada de todos los endpoints.

### Ejemplos de Uso

Consulta [EXAMPLES.md](./EXAMPLES.md) para ejemplos prácticos con cURL, Postman, JavaScript y Python.

## 🔗 Endpoints Principales

| Método | Endpoint               | Descripción               |
| ------ | ---------------------- | ------------------------- |
| `POST` | `/upload`              | Subir archivo             |
| `GET`  | `/download/:packageId` | Descargar paquete cifrado |
| `POST` | `/decrypt`             | Descifrar paquete         |
| `GET`  | `/metadata/:packageId` | Obtener metadatos         |
| `POST` | `/keys/public`         | Registrar llave pública   |
| `GET`  | `/keys/users/:id`      | Listar llaves de usuario  |
| `GET`  | `/health`              | Health check              |

## 🧪 Ejemplos Rápidos

### Subir un archivo

```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@documento.pdf" \
  -F "userId=user123"
```

### Descargar un paquete

```bash
curl -X GET http://localhost:3000/download/{packageId} \
  -o archivo_descargado.enc
```

### Obtener metadatos

```bash
curl -X GET http://localhost:3000/metadata/{packageId}
```

### Registrar llave pública

```bash
curl -X POST http://localhost:3000/keys/public \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "algorithm": "RSA-4096"
  }'
```

## 🛠️ Tecnologías

- **[Node.js](https://nodejs.org/)** - Runtime de JavaScript
- **[TypeScript](https://www.typescriptlang.org/)** - JavaScript con tipos
- **[Express.js](https://expressjs.com/)** - Framework web
- **[Swagger](https://swagger.io/)** - Documentación de API
- **[Multer](https://github.com/expressjs/multer)** - Manejo de archivos multipart
- **[Pino](https://getpino.io/)** - Logger de alto rendimiento
- **[Helmet](https://helmetjs.github.io/)** - Seguridad HTTP
- **[CORS](https://github.com/expressjs/cors)** - Control de acceso
- **[Supabase](https://supabase.com/)** - Storage de archivos en la nube

## 📦 Estructura de Datos

### FilePackage

```typescript
{
  packageId: string;
  filename: string;
  originalSize: number;
  encryptedSize: number;
  mimeType: string;
  uploadedAt: Date;
  expiresAt: Date;
  encryptedPath: string;
  signature?: string;
  uploaderId: string;
  publicKeyFingerprint: string;
}
```

### PackageMetadata

```typescript
{
  packageId: string;
  filename: string;
  originalSize: number;
  encryptedSize: number;
  mimeType: string;
  uploadedAt: Date;
  expiresAt: Date;
  status: "active" | "expired" | "downloaded" | "deleted";
  uploaderId: string;
  uploaderPublicKeyFingerprint: string;
  signature?: string;
  downloadCount: number;
}
```

### PublicKey

```typescript
{
  keyId: string;
  userId: string;
  publicKey: string;
  fingerprint: string;
  algorithm: string;
  createdAt: Date;
  isActive: boolean;
}
```

## 🔐 Consideraciones de Seguridad

- ⚠️ **Almacenamiento en memoria**: Los metadatos se almacenan en memoria (usar base de datos en producción)
- ⚠️ **Autenticación**: No implementada (requerida en producción)
- ⚠️ **Cifrado real**: Implementación de cifrado pendiente
- ✅ **Supabase Storage**: Los archivos se almacenan de forma segura en Supabase
- ✅ **Helmet**: Protección de headers HTTP
- ✅ **CORS**: Configurado y habilitado
- ✅ **Expiración**: Los paquetes expiran en 7 días
- ✅ **Límite de tamaño**: 50 MB por archivo

## 🗺️ Roadmap

### Fase 1 - Completada ✅

- [x] Configuración del proyecto
- [x] Estructura de carpetas
- [x] Configuración de TypeScript
- [x] Configuración de ESLint y Prettier
- [x] Logging con Pino

### Fase 2 - Completada ✅

- [x] Diseño de la API REST
- [x] Implementación de endpoints
- [x] Documentación Swagger
- [x] Manejo de archivos con Multer
- [x] Integración con Supabase Storage

### Fase 3 - Pendiente 🚧

- [ ] Implementación real de cifrado/descifrado
- [ ] Integración con base de datos (PostgreSQL/MongoDB)
- [ ] Sistema de autenticación (JWT)
- [ ] Sistema de autorización (roles y permisos)

### Fase 4 - Pendiente 📋

- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] CI/CD con GitHub Actions
- [ ] Dockerización

### Fase 5 - Pendiente 🚀

- [ ] Rate limiting
- [ ] Monitoreo y métricas
- [ ] Deployment en producción
- [ ] Documentación de deployment

## 🧪 Testing

```bash
# Ejecutar tests (cuando estén implementados)
npm test

# Cobertura de código
npm run test:coverage
```

## 📝 Scripts Disponibles

| Comando                | Descripción                                 |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Ejecutar en modo desarrollo con hot-reload  |
| `npm run build`        | Compilar TypeScript a JavaScript            |
| `npm start`            | Ejecutar versión compilada                  |
| `npm run lint`         | Ejecutar linter                             |
| `npm run lint:fix`     | Corregir errores de linting automáticamente |
| `npm run format`       | Formatear código con Prettier               |
| `npm run format:check` | Verificar formato del código                |

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

ISC

## 👥 Autor

Desarrollado para el proyecto SEIP - Secure Transfer

## 📞 Soporte

Para soporte, por favor abre un issue en el repositorio o contacta a support@securetransfer.com

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub
