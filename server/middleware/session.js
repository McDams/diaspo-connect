const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const pool = require("../db/pool");

module.exports = session({
  store: new pgSession({ pool, tableName: "session" }),
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // passer à true derrière HTTPS en production
    maxAge: 1000 * 60 * 60 * 8, // 8h
  },
});
