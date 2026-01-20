import express from 'express';
import dotenv from 'dotenv';
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors()); // allow all origins for testing
app.use(express.json()); // parse JSON body
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Wake endpoint
app.get('/wake', (req, res) => {
  res.json({ status: 'ok', message: 'Server is awake!' });
});

// MakeBoard endpoint
app.post('/makeBoard', async (req, res) => {
  try {
    const input = req.body; // JSON body from the client
    if (!input || !Array.isArray(input.quizzes) || input.quizzes.length === 0) {
      return res.status(400).json({ error: 'No quizzes provided' });
    }

    // For testing, just return a simplified Jeopardy board
    // Use your logic or call your Groq agent here
    const board = {
      categories: input.quizzes.map((quiz, i) => ({
        name: quiz.title || `Category ${i + 1}`,
        clues: quiz.questions.slice(0, 3) // pick 3 questions per quiz for demo
      })),
      finalJeopardy: {
        category: 'Final Question',
        question: 'Sample Final Jeopardy',
        answers: ['Answer 1', 'Answer 2']
      }
    };

    res.json({ status: 'ok', board });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CheckAnswer endpoint (simplified test)
app.post('/checkAnswer', async (req, res) => {
  try {
    const payload = req.body;

    const groqRes = await fetch("https://api.groq.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: CHECKER_PROMPT },
          { role: "user", content: JSON.stringify(payload) }
        ]
      })
    });

    if (!groqRes.ok) {
      const text = await groqRes.text();
      console.error("Groq error:", text);
      return res.status(500).json({ error: "Groq call failed", details: text });
    }

    const data = await groqRes.json();

    const parsed = JSON.parse(data.choices[0].message.content);

    res.json(parsed);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
