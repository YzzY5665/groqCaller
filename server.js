import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Resolve directory safely (Render-compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompts safely
function loadPrompt(filename) {
  const fullPath = path.join(__dirname, filename);
  const json = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  if (!json.prompt) {
    throw new Error(`Prompt file ${filename} missing "prompt" field`);
  }
  return json.prompt;
}

const CHECKER_PROMPT = loadPrompt("checkAnswer.json");
const BOARD_PROMPT = loadPrompt("makeBoard.json");

console.log("Loaded prompts:",
  "\n - checkAnswer:", CHECKER_PROMPT.length,
  "\n - makeBoard:", BOARD_PROMPT.length
);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Shared Groq call helper
async function callGroq(prompt, payload) {
  const res = await fetch("https://api.groq.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(payload) }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Groq error:", text);
    throw new Error("Groq call failed: " + text);
  }

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.error("JSON parse error:", data);
    throw new Error("Groq returned invalid JSON");
  }
}

// Wake endpoint
app.get("/wake", (req, res) => {
  res.json({ status: "ok", message: "Server is awake!" });
});

// MakeBoard endpoint (now Groq-powered)
app.post("/makeBoard", async (req, res) => {
  try {
    const input = req.body;

    if (!input || !Array.isArray(input.quizzes) || input.quizzes.length === 0) {
      return res.status(400).json({ error: "No quizzes provided" });
    }

    const board = await callGroq(BOARD_PROMPT, input);

    res.json({ status: "ok", board });
  } catch (err) {
    console.error("MakeBoard error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// CheckAnswer endpoint (Groq-powered)
app.post("/checkAnswer", async (req, res) => {
  try {
    const payload = req.body;

    const result = await callGroq(CHECKER_PROMPT, payload);

    res.json(result);
  } catch (err) {
    console.error("CheckAnswer error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});