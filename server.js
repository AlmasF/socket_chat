import express from "express";
import sqlite3 from "sqlite3";
import cluster from "node:cluster";
import { open } from "sqlite";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { availableParallelism } from "node:os";
import { createAdapter, setupPrimary } from "@socket.io/cluster-adapter";

const initDB = async () => {
  // open the database file
  const db = await open({
    filename: "chat.db",
    driver: sqlite3.Database,
  });

  // create our 'messages' table (you can ignore the 'client_offset' column for now)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );`);
  return { db };
};

const initApp = (db) => {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {}, // set up the adapter on each worker thread
    adapter: createAdapter(),
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
  });

  app.get("/detector.js", (req, res) => {
    res.sendFile(join(__dirname, "detector.js"));
  });

  io.on("connection", async (socket) => {
    socket.on("disconnect", () => {
      //   console.log("user disconnected");
    });

    socket.on("chat message", async (msg, clientOffset, callback) => {
      let result;
      try {
        // store the message in the database
        result = await db.run(
          "INSERT INTO messages (content, client_offset) VALUES (?, ?)",
          msg,
          clientOffset,
        );
      } catch (e) {
        if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
          // the message was already inserted, so we notify the client
          callback();
        } else {
          // nothing to do, just let the client retry
        }
        return;
      }
      // include the offset with the message
      io.emit("chat message", msg, result.lastID);
      callback();
    });

    if (!socket.recovered) {
      // if the connection state recovery was not successful
      try {
        await db.each(
          "SELECT id, content FROM messages WHERE id > ?",
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit("chat message", row.content, row.id);
          },
        );
      } catch {
        // something went wrong
      }
    }
  });

  const port = process.env.PORT;

  server.listen(port, () => {
    // console.log(`server running at http://localhost:${port}`);
  });
};

const initCluster = () => {
  const numCPUs = availableParallelism();
  // create one worker per available core
  // I got 16 returned as available cores
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      PORT: 3000 + i,
    });
  }

  // set up the adapter on the primary thread
  setupPrimary();
};

const { db } = await initDB();

if (cluster.isPrimary) {
  initCluster();
} else {
  initApp(db);
}
