import dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config();

import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import cors from "cors";
import helmet from "helmet";
import fileRoutes from "./routes/fileRoutes.js";
import keysRoutes from "./routes/keysRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { ensureBucketExists } from "./services/supabaseService.js";
import logger from "./utils/logger.js";

const app = express();
const port = process.env["PORT"] || 3000;

// Middleware de seguridad
app.use(helmet());
app.use(cors());

// Middleware básico con límites aumentados para manejar manifests grandes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configuración de Swagger
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Secure Transfer API",
      version: "1.0.0",
      description:
        "API para transferencia segura de archivos con cifrado de extremo a extremo",
      contact: {
        name: "API Support",
        email: "support@securetransfer.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Servidor de desarrollo",
      },
    ],
    tags: [
      {
        name: "General",
        description: "Endpoints generales del sistema",
      },
      {
        name: "Health",
        description: "Endpoints de salud del sistema",
      },
      {
        name: "Archivos",
        description: "Gestión de archivos cifrados",
      },
      {
        name: "Llaves",
        description: "Gestión de llaves públicas y privadas",
      },
      {
        name: "Autenticación",
        description: "Gestión de usuarios y autenticación",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/index.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas principales
/**
 * @swagger
 * /:
 *   get:
 *     summary: Endpoint raíz de la API
 *     description: Devuelve información básica sobre la API
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Respuesta exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Secure Transfer API v1.0.0"
 *                 documentation:
 *                   type: string
 *                   example: "/api-docs"
 */
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Secure Transfer API v1.0.0",
    documentation: "/api-docs",
    endpoints: {
      files: "/upload, /download/:packageId, /decrypt, /metadata/:packageId",
      keys: "/keys/public, /keys/users/:id",
    },
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Verifica el estado de salud del servidor
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: Tiempo de actividad en segundos
 *                   example: 3600
 */
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rutas de la API
app.use("/auth", authRoutes);
app.use("/", fileRoutes);
app.use("/keys", keysRoutes);

// Iniciar servidor y verificar bucket de Supabase
app.listen(port, async () => {
  console.log(`✅ Servidor escuchando en el puerto ${port}`);
  console.log(`📚 Swagger disponible en http://localhost:${port}/api-docs`);
  console.log(`💚 API health disponible en http://localhost:${port}/health`);

  // Verificar/crear bucket de Supabase
  try {
    await ensureBucketExists();
    console.log("✅ Conexión con Supabase Storage establecida");
    logger.info("Conexión con Supabase Storage establecida");
  } catch (error) {
    logger.error({ error }, "Error al conectar con Supabase Storage");
    console.error(
      "⚠️ Error al conectar con Supabase. Verifica las credenciales en .env"
    );
    console.error(error);
  }
});
