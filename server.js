require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(bodyParser.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = process.env.PORT || 3000;

// Wake endpoint
app.get('/wake', (req, res) => {
  res.send({status: 'ok', message: 'Server is awake!'});
});

// MakeBoard agent endpoint
app.post('/makeBoard', async (req, res) => {
  const inputJSON = req.body;

  if (!inputJSON) {
    return res.status(400).json({error: 'Missing input JSON'});
  }

  try {
    const response = await fetch('https://api.groq.ai/agents/makeBoard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({prompt: inputJSON})
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({error: text});
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Error calling Groq agent:', err);
    res.status(500).json({error: 'Internal server error'});
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
