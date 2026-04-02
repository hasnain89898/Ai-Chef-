import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database
const db = new Database("chefai.db");

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    photo_url TEXT,
    preferred_cuisine TEXT DEFAULT 'Mediterranean',
    taste_dna TEXT DEFAULT '{"sweetness": 50, "saltiness": 50, "spiciness": 50, "umami": 50, "acidity": 50}',
    image_upload_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fridge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    name TEXT,
    quantity TEXT,
    unit TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    title TEXT,
    description TEXT,
    ingredients TEXT,
    instructions TEXT,
    cuisine TEXT,
    difficulty TEXT,
    time TEXT,
    nutrition TEXT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cravings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    mood TEXT,
    weather TEXT,
    predicted_dish TEXT,
    confidence INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    recipe_id INTEGER,
    date TEXT,
    meal_type TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(recipe_id) REFERENCES recipes(id)
  );

  CREATE TABLE IF NOT EXISTS grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    name TEXT,
    quantity TEXT,
    unit TEXT,
    is_checked INTEGER DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'free',
    plan TEXT DEFAULT 'none',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ChefAI Backend with SQLite is running" });
  });

  // User Profile
  app.get("/api/users/:userId", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.userId) as any;
    if (user) {
      user.taste_dna = JSON.parse(user.taste_dna);
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { id, email, display_name, photo_url } = req.body;
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (existing) {
      existing.taste_dna = JSON.parse(existing.taste_dna);
      return res.json(existing);
    }
    db.prepare("INSERT INTO users (id, email, display_name, photo_url) VALUES (?, ?, ?, ?)").run(id, email, display_name, photo_url);
    const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    newUser.taste_dna = JSON.parse(newUser.taste_dna);
    res.json(newUser);
  });

  app.patch("/api/users/:userId", (req, res) => {
    const { preferred_cuisine, taste_dna } = req.body;
    if (taste_dna) {
      db.prepare("UPDATE users SET preferred_cuisine = ?, taste_dna = ? WHERE id = ?").run(preferred_cuisine, JSON.stringify(taste_dna), req.params.userId);
    } else {
      db.prepare("UPDATE users SET preferred_cuisine = ? WHERE id = ?").run(preferred_cuisine, req.params.userId);
    }
    res.json({ success: true });
  });

  // Fridge Items
  app.get("/api/users/:userId/fridge", (req, res) => {
    const items = db.prepare("SELECT * FROM fridge_items WHERE user_id = ? ORDER BY added_at DESC").all(req.params.userId);
    res.json(items);
  });

  app.post("/api/users/:userId/fridge", (req, res) => {
    const { name, quantity, unit } = req.body;
    const result = db.prepare("INSERT INTO fridge_items (user_id, name, quantity, unit) VALUES (?, ?, ?, ?)").run(req.params.userId, name, quantity, unit);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/fridge/:id", (req, res) => {
    db.prepare("DELETE FROM fridge_items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Recipes
  app.get("/api/users/:userId/recipes", (req, res) => {
    const items = db.prepare("SELECT * FROM recipes WHERE user_id = ? ORDER BY generated_at DESC").all(req.params.userId) as any[];
    items.forEach(item => {
      item.ingredients = JSON.parse(item.ingredients);
      item.instructions = JSON.parse(item.instructions);
      item.nutrition = JSON.parse(item.nutrition);
    });
    res.json(items);
  });

  app.post("/api/users/:userId/recipes", (req, res) => {
    const { title, description, ingredients, instructions, cuisine, difficulty, time, nutrition } = req.body;
    const result = db.prepare(`
      INSERT INTO recipes (user_id, title, description, ingredients, instructions, cuisine, difficulty, time, nutrition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.userId,
      title,
      description,
      JSON.stringify(ingredients),
      JSON.stringify(instructions),
      cuisine,
      difficulty,
      time,
      JSON.stringify(nutrition)
    );
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/recipes/:id", (req, res) => {
    db.prepare("DELETE FROM recipes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Cravings
  app.get("/api/users/:userId/cravings", (req, res) => {
    const items = db.prepare("SELECT * FROM cravings WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5").all(req.params.userId);
    res.json(items);
  });

  app.post("/api/users/:userId/cravings", (req, res) => {
    const { mood, weather, predicted_dish, confidence } = req.body;
    const result = db.prepare("INSERT INTO cravings (user_id, mood, weather, predicted_dish, confidence) VALUES (?, ?, ?, ?, ?)").run(req.params.userId, mood, weather, predicted_dish, confidence);
    res.json({ id: result.lastInsertRowid });
  });

  // Chat Messages
  app.get("/api/users/:userId/chat", (req, res) => {
    const items = db.prepare("SELECT * FROM chat_messages WHERE user_id = ? ORDER BY timestamp ASC LIMIT 50").all(req.params.userId);
    res.json(items);
  });

  app.post("/api/users/:userId/chat", (req, res) => {
    const { role, content } = req.body;
    const result = db.prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)").run(req.params.userId, role, content);
    res.json({ id: result.lastInsertRowid });
  });

  // Meal Plans
  app.get("/api/users/:userId/meal-plan", (req, res) => {
    const items = db.prepare(`
      SELECT mp.*, r.title as recipe_title 
      FROM meal_plans mp
      LEFT JOIN recipes r ON mp.recipe_id = r.id
      WHERE mp.user_id = ? 
      ORDER BY mp.date ASC
    `).all(req.params.userId);
    res.json(items);
  });

  app.post("/api/users/:userId/meal-plan", (req, res) => {
    const { recipe_id, date, meal_type } = req.body;
    const result = db.prepare("INSERT INTO meal_plans (user_id, recipe_id, date, meal_type) VALUES (?, ?, ?, ?)").run(req.params.userId, recipe_id, date, meal_type);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/meal-plan/:id", (req, res) => {
    db.prepare("DELETE FROM meal_plans WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Grocery List
  app.get("/api/users/:userId/grocery", (req, res) => {
    const items = db.prepare("SELECT * FROM grocery_items WHERE user_id = ? ORDER BY added_at DESC").all(req.params.userId);
    res.json(items);
  });

  app.post("/api/users/:userId/grocery", (req, res) => {
    const { name, quantity, unit } = req.body;
    const result = db.prepare("INSERT INTO grocery_items (user_id, name, quantity, unit) VALUES (?, ?, ?, ?)").run(req.params.userId, name, quantity, unit);
    res.json({ id: result.lastInsertRowid });
  });

  app.patch("/api/grocery/:id", (req, res) => {
    const { is_checked } = req.body;
    db.prepare("UPDATE grocery_items SET is_checked = ? WHERE id = ?").run(is_checked ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/grocery/:id", (req, res) => {
    db.prepare("DELETE FROM grocery_items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Subscriptions
  app.get("/api/users/:userId/subscription", (req, res) => {
    const sub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(req.params.userId);
    if (sub) {
      res.json(sub);
    } else {
      res.json({ status: 'free', plan: 'none' });
    }
  });

  app.post("/api/users/:userId/subscription", (req, res) => {
    const { status, plan } = req.body;
    db.prepare("INSERT OR REPLACE INTO subscriptions (user_id, status, plan, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)").run(req.params.userId, status, plan);
    res.json({ success: true });
  });

  app.patch("/api/users/:userId/increment-image-count", (req, res) => {
    db.prepare("UPDATE users SET image_upload_count = image_upload_count + 1 WHERE id = ?").run(req.params.userId);
    res.json({ success: true });
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
