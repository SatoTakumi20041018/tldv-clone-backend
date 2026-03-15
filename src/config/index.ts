export const config = {
  port: parseInt(process.env.PORT || "3006", 10),
  jwtSecret: process.env.JWT_SECRET || "tldv-clone-jwt-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000", "http://localhost:3007", "https://frontend-five-zeta-15.vercel.app"],
  defaultPageSize: 20,
  maxPageSize: 100,
};
