require('dotenv').config(); // <-- load .env variables
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

// --- CONFIG ---
const GROQ_API_KEY = process.env.GROQ_API_KEY; // from .env
const port = process.env.PORT || 3000;         // from .env or fallback

// --- /wake endpoint ---
app.get('/wake', (req, res) => {
  res.send('Server is awake!');
});

// --- /makeBoard endpoint ---
app.post('/makeBoard', async (req, res) => {
  const inputJSON = req.body;

  if (!inputJSON) {
    return res.status(400).json({ error: 'Missing input JSON' });
  }

  try {
    const response = await fetch('https://api.groq.ai/v1/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-agent', // replace with your agent if needed
        input: inputJSON
      })
    });

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process agent request' });
  }
});

// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
