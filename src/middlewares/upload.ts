import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

// Directorio para almacenar archivos subidos
const uploadDir = path.join(process.cwd(), "uploads");

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Filtro de archivos (opcional - limitar tipos)
const fileFilter = (
  _req: Express.Request,
  _file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Permitir todos los tipos de archivos
  cb(null, true);
};

// Configuración de multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB máximo
  },
});
