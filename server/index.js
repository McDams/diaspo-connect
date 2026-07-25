require("dotenv").config();
require("express-async-errors");
const path = require("path");
const express = require("express");
const sessionMiddleware = require("./middleware/session");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const messagesRoutes = require("./routes/messages");
const auditLogRoutes = require("./routes/audit-log");
const settingsRoutes = require("./routes/settings");
const resourcesRoutes = require("./routes/resources");

const app = express();
const FRONTEND_ROOT = path.join(__dirname, "..");

app.use(express.json());
app.use(sessionMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/audit-log", auditLogRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", resourcesRoutes);

app.use("/api", (req, res) => res.status(404).json({ error: "Route API introuvable." }));

// Sert le frontend statique (HTML/CSS/JS) tel quel — un seul serveur, un seul port.
app.use(express.static(FRONTEND_ROOT));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur." });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`DiaspoConnect server listening on http://localhost:${port}`);
});
