// Vercel Serverless Function
// This code runs on Vercel's server, NOT in the visitor's browser.
// That's important: it's the only safe place to use your secret API key,
// because anything that runs in the browser can be seen by anyone.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "이 주소는 POST 요청만 받아요." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "ANTHROPIC_API_KEY가 설정되지 않았어요. Vercel 프로젝트 설정의 Environment Variables에서 추가해주세요.",
    });
    return;
  }

  try {
    const { system, messages } = req.body || {};
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system,
        messages,
      }),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
