
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL = "wan-video/wan-2.2-5b-fast";
const API = "https://api.replicate.com/v1";

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    tokenSet: Boolean(TOKEN),
    port: PORT
  });
});

app.post("/api/generate", async (req, res) => {
  if (!TOKEN) {
    return res.status(500).json({
      error: "Render Environment da REPLICATE_API_TOKEN yo‘q."
    });
  }

  const prompt = String(req.body.prompt || "").trim();

  if (prompt.length < 5 || prompt.length > 1000) {
    return res.status(400).json({
      error: "Video g‘oyasini 5–1000 belgi bilan yozing."
    });
  }

  try {
    const response = await fetch(
      `${API}/models/${MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: { prompt }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Replicate API xatosi:", response.status, data);
      return res.status(response.status).json({
        error: data.detail || data.title ||
          `Replicate API xatosi: ${response.status}`
      });
    }

    res.json({
      id: data.id,
      status: data.status
    });
  } catch (error) {
    console.error("Server xatosi:", error.message);
    res.status(500).json({
      error: "Server xatosi. Render Logs ni tekshiring."
    });
  }
});

app.get("/api/status/:id", async (req, res) => {
  if (!TOKEN) {
    return res.status(500).json({
      error: "REPLICATE_API_TOKEN sozlanmagan."
    });
  }

  try {
    const response = await fetch(
      `${API}/predictions/${encodeURIComponent(req.params.id)}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Status API xatosi:", response.status, data);
      return res.status(response.status).json({
        error: data.detail || data.title ||
          `Video holati xatosi: ${response.status}`
      });
    }

    let output = data.output;

    if (Array.isArray(output)) {
      output = output[0];
    }

    res.json({
      status: data.status,
      output: output || null,
      error: data.error || null
    });
  } catch (error) {
    console.error("Status tekshirish xatosi:", error.message);
    res.status(500).json({
      error: "Video holatini tekshirishda server xatosi."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server ishga tushdi:", PORT);
});
