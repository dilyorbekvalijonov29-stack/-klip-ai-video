
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL = "wan-video/wan-2.2-5b-fast";
const API = "https://api.replicate.com/v1";

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, tokenSet: Boolean(TOKEN) });
});

app.post("/api/generate", async (req, res) => {
  if (!TOKEN) {
    return res.status(500).json({ error: "Render serverida API token sozlanmagan." });
  }

  const prompt = String(req.body.prompt || "").trim();
  if (prompt.length < 5 || prompt.length > 1000) {
    return res.status(400).json({ error: "Video g‘oyasini 5–1000 belgi bilan yozing." });
  }

  try {
    const response = await fetch(`${API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: { prompt } })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data.detail || data.title || "Video yaratish xatosi." });
    }

    res.json({ id: data.id, status: data.status });
  } catch (error) {
    res.status(500).json({ error: "Server xatosi. Qayta urinib ko‘ring." });
  }
});

app.get("/api/status/:id", async (req, res) => {
  if (!TOKEN) {
    return res.status(500).json({ error: "API token sozlanmagan." });
  }

  try {
    const response = await fetch(`${API}/predictions/${encodeURIComponent(req.params.id)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data.detail || "Video holatini olib bo‘lmadi." });
    }

    let output = data.output;
    if (Array.isArray(output)) output = output[0];

    res.json({ status: data.status, output: output || null, error: data.error || null });
  } catch (error) {
    res.status(500).json({ error: "Video holatini tekshirishda xato." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server ishga tushdi:", PORT);
});
