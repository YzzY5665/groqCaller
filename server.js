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
const RANKER_PROMPT = loadPrompt("rankAnswers.json");

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

// ===============================
// INPUT VALIDATORS (before AI call)
// ===============================

// /checkAnswer input validator
function validateCheckAnswerInput(payload) {
  return (
    payload &&
    typeof payload.question === "string" &&
    Array.isArray(payload.correct_answers) &&
    payload.correct_answers.every(a => typeof a === "string") &&
    typeof payload.user_answer === "string" &&
    typeof payload.mode === "string"
  );
}

// /rankAnswers input validator
function validateRankAnswersInput(payload) {
  return (
    payload &&
    typeof payload.question === "string" &&
    typeof payload.example_correct_answer === "string" &&
    Array.isArray(payload.answers) &&
    payload.answers.every(a => typeof a === "string")
  );
}

// /makeBoard input validator
function validateMakeBoardInput(payload) {
  if (!payload || !Array.isArray(payload.quizzes)) return false;

  return payload.quizzes.every(q =>
    q &&
    typeof q.title === "string" &&
    Array.isArray(q.questions) &&
    q.questions.every(qq =>
      qq &&
      typeof qq.question === "string" &&
      Array.isArray(qq.answers) &&
      qq.answers.every(a => typeof a === "string")
    )
  );
}

// ===============================
// Shared Groq call helper
// ===============================
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

// ===============================
// Wake endpoint
// ===============================
app.get("/wake", (req, res) => {
  res.json({ status: "ok", message: "Server is awake!" });
});

// ===============================
// MakeBoard endpoint
// ===============================
app.post("/makeBoard", async (req, res) => {
  try {
    const input = req.body;

    debugLog("Incoming /makeBoard payload:", input);

    if (!validateMakeBoardInput(input)) {
      return res.status(400).json({
        error: "Invalid makeBoard payload format",
        expected: {
          quizzes: [
            {
              title: "string",
              questions: [
                { question: "string", answers: ["string"] }
              ]
            }
          ]
        }
      });
    }

    const board = await callGroq(BOARD_PROMPT, input);

    res.json({ status: "ok", board });
  } catch (err) {
    console.error("❌ MakeBoard error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================
// CheckAnswer endpoint
// ===============================
app.post("/checkAnswer", async (req, res) => {
  try {
    const payload = req.body;

    debugLog("Incoming /checkAnswer payload:", payload);

    if (!validateCheckAnswerInput(payload)) {
      return res.status(400).json({
        error: "Invalid checkAnswer payload format",
        expected: {
          question: "string",
          correct_answers: ["string"],
          user_answer: "string",
          mode: "string"
        }
      });
    }

    const result = await callGroq(CHECKER_PROMPT, payload);

    res.json(result);
  } catch (err) {
    console.error("❌ CheckAnswer error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================
// RankAnswers endpoint
// ===============================
app.post("/rankAnswers", async (req, res) => {
  try {
    const payload = req.body;

    debugLog("Incoming /rankAnswers payload:", payload);

    if (!validateRankAnswersInput(payload)) {
      return res.status(400).json({
        error: "Invalid rankAnswers payload format",
        expected: {
          question: "string",
          example_correct_answer: "string",
          answers: ["string"]
        }
      });
    }

    const result = await callGroq(RANKER_PROMPT, payload);

    res.json({ status: "ok", result });
  } catch (err) {
    console.error("❌ RankAnswers error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================
// Start server
// ===============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});