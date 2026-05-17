export const errorHandler = (err, req, res, next) => {
  console.error("[Global Error]:", err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Terjadi kesalahan server internal.";

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
