import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Debug mode ON by default
const DEBUG = true;

// Resolve directory safely (Render-compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logger
function debugLog(...args) {
  if (DEBUG) console.log("[DEBUG]", ...args);
}

// Load and validate prompt files
function loadPrompt(filename) {
  const fullPath = path.join(__dirname, "agents", filename);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Prompt file not found: ${fullPath}`);
  }

  debugLog("Loading prompt:", fullPath);

  let raw;
  try {
    raw = fs.readFileSync(fullPath, "utf8");
  } catch (err) {
    throw new Error(`Failed reading prompt file ${filename}: ${err.message}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filename}: ${err.message}`);
  }

  if (!json.prompt || typeof json.prompt !== "string") {
    throw new Error(`Prompt file ${filename} missing required "prompt" string`);
  }

  debugLog(`Loaded ${filename} (${json.prompt.length} chars)`);

  return json.prompt;
}

// Load prompts from /agents
const CHECKER_PROMPT = loadPrompt("checkAnswer.json");
const BOARD_PROMPT = loadPrompt("makeBoard.json");

// Validate environment variables
if (!process.env.GROQ_API_KEY) {
  console.error("❌ Missing GROQ_API_KEY in environment");
  process.exit(1);
}

debugLog("Environment validated. GROQ_API_KEY loaded.");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Shared Groq call helper with full debugging
async function callGroq(prompt, payload) {
  debugLog("Calling Groq with payload:", payload);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(payload) }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Groq HTTP error:", res.status, text);
    throw new Error(`Groq HTTP error ${res.status}: ${text}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error("❌ Failed to parse Groq JSON:", err);
    throw new Error("Groq returned non-JSON response");
  }

  debugLog("Groq raw response:", data);

  if (!data.choices || !data.choices[0]?.message?.content) {
    console.error("❌ Groq response missing expected fields:", data);
    throw new Error("Groq response missing message content");
  }

  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    debugLog("Parsed Groq JSON:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ Groq returned invalid JSON:", data.choices[0].message.content);
    throw new Error("Groq returned invalid JSON");
  }
}

// Wake endpoint
app.get("/wake", (req, res) => {
  res.json({ status: "ok", message: "Server is awake!" });
});

// MakeBoard endpoint (Groq-powered)
app.post("/makeBoard", async (req, res) => {
  try {
    const input = req.body;

    debugLog("Incoming /makeBoard payload:", input);

    if (!input || !Array.isArray(input.quizzes) || input.quizzes.length === 0) {
      return res.status(400).json({ error: "No quizzes provided" });
    }

    const board = await callGroq(BOARD_PROMPT, input);

    res.json({ status: "ok", board });
  } catch (err) {
    console.error("❌ MakeBoard error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// CheckAnswer endpoint (Groq-powered)
app.post("/checkAnswer", async (req, res) => {
  try {
    const payload = req.body;

    debugLog("Incoming /checkAnswer payload:", payload);

    const result = await callGroq(CHECKER_PROMPT, payload);

    res.json(result);
  } catch (err) {
    console.error("❌ CheckAnswer error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});