import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json()); // parse JSON body

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ----------------------
// Wake endpoint
// ----------------------
app.get('/wake', (req, res) => {
  res.json({ status: 'ok', message: 'Server is awake!' });
});

// ----------------------
// MakeBoard agent endpoint
// ----------------------
app.post('/makeBoard', (req, res) => {
  const input = req.body; // Expect quizzes JSON
  if (!input || !input.quizzes) {
    return res.status(400).json({ error: 'Missing quizzes in request body' });
  }

  // Dummy implementation for testing
  const board = {
    categories: [
      {
        name: 'Sample Category',
        clues: input.quizzes[0].questions.slice(0, 3),
      },
    ],
    finalJeopardy: {
      category: 'Final Category',
      question: input.quizzes[0].questions[0].question,
      answers: input.quizzes[0].questions[0].answers,
    },
  };

  res.json(board);
});

// ----------------------
// CheckAnswer agent endpoint
// ----------------------
app.post('/checkAnswer', (req, res) => {
  const input = req.body;
  if (!input || !input.question || !input.correct_answers || !input.user_answer) {
    return res.status(400).json({ error: 'Invalid input JSON' });
  }

  // Simple normalization example
  let normalizedUserAnswer = input.user_answer.toLowerCase().trim();
  const normalizedCorrectAnswers = input.correct_answers.map(a => a.toLowerCase().trim());

  const matchedAnswer = normalizedCorrectAnswers.includes(normalizedUserAnswer)
    ? normalizedUserAnswer
    : null;

  const response = {
    correct: matchedAnswer !== null,
    score: matchedAnswer !== null ? 1 : 0,
    matched_answer: matchedAnswer,
    reason: matchedAnswer ? 'Exact match' : 'No match',
    normalized_user_answer: normalizedUserAnswer,
    normalized_correct_answers: normalizedCorrectAnswers,
  };

  res.json(response);
});

// ----------------------
// Start server
// ----------------------
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // ----------------------
  // Self-test for checkAnswer
  // ----------------------
  const testInput = {
    question: 'Capital of France?',
    correct_answers: ['Paris'],
    user_answer: 'Paris',
    mode: 'strict',
    options: { ignore_case: true, ignore_punctuation: true, ignore_articles: false, allow_minor_typos: false, max_levenshtein_distance: 1 },
  };

  try {
    const fetchResponse = await fetch(`http://localhost:${PORT}/checkAnswer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testInput),
    });
    const data = await fetchResponse.json();
    console.log('Self-test /checkAnswer result:', data);
  } catch (err) {
    console.error('Self-test failed:', err);
  }
});
