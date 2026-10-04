import multer from "multer";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(badRequest("Resume must be a PDF file."));
  }
});

export default upload;
