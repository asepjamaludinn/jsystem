export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    next();
  } catch (error) {
    const errorMessages = error.errors.map((err) => err.message).join(", ");
    return res.status(400).json({
      success: false,
      error: errorMessages,
    });
  }
};
