import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function searchWithTavily(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 3,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily error: ${res.status}`);
  return res.json();
}

app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: 'Text too short.' });
  }

  try {
    const tavilyData = await searchWithTavily(text.slice(0, 400));
    const results = tavilyData.results || [];

    const searchContext = results.length
      ? results
          .map(
            (r, i) =>
              `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nDate: ${r.published_date || 'Unknown'}\nContent: ${(r.content || '').slice(0, 500)}`
          )
          .join('\n\n')
      : 'No web results found.';

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `You are a misinformation detection expert. Today is ${today}.

Based on these web search results:
${searchContext}

Analyze this claim and return ONLY valid JSON — no markdown, no backticks, no preamble:
{
  "verdict": "Likely Real" | "Likely Fake" | "Misleading" | "Unverifiable",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence plain-English assessment>",
  "signals": [
    { "label": "<signal name>", "value": "<short finding>", "flag": "positive" | "negative" | "neutral" }
  ],
  "sources": [
    { "title": "<source title>", "url": "<full URL>", "date": "<date or empty string>" }
  ]
}

Include 4-5 signals. Use the actual Tavily sources in the sources array (real URLs only).

Claim: """${text}"""`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

app.listen(port, () => console.log(`TruthCheck backend running on port ${port}`));