import multer from "multer";

// Configuración de almacenamiento en memoria
// Los archivos se almacenarán temporalmente en memoria antes de subirlos a Supabase
const storage = multer.memoryStorage();

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
// Límite de 50 MB para Supabase Storage
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB máximo (límite de Supabase)
  },
});
