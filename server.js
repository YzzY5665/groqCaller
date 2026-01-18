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
  const { question, correct_answers, user_answer } = req.body;
  if (!question || !correct_answers || !user_answer) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const normalizedUser = user_answer.trim().toLowerCase();
  const normalizedCorrect = correct_answers.map(a => a.trim().toLowerCase());
  const correct = normalizedCorrect.includes(normalizedUser);

  res.json({
    correct,
    score: correct ? 1 : 0,
    matched_answer: correct ? normalizedUser : null,
    reason: correct ? 'Exact match' : 'Incorrect',
    normalized_user_answer: normalizedUser,
    normalized_correct_answers: normalizedCorrect
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
