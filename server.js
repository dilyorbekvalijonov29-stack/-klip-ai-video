
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Replicate from "replicate";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet());
app.use(express.json({ limit: "20kb" }));
app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 10
}));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "AI video server is running" });
});

app.post("/api/videos", async (req, res) => {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "Serverga Replicate API token hali ulanmagan."
    });
  }

  const prompt = typeof req.body?.prompt === "string"
    ? req.body.prompt.trim()
    : "";

  if (prompt.length < 5 || prompt.length > 1200) {
    return res.status(400).json({
      error: "Video g‘oyasini 5–1200 belgi oralig‘ida yozing."
    });
  }

  try {
    const replicate = new Replicate({ auth: token });

    const prediction = await replicate.predictions.create({
      model: "pixverse/pixverse-v6",
      input: {
        prompt,
        duration: 5,
        aspect_ratio: "9:16",
        quality: "360p",
        generate_audio_switch: false
      }
    });

    res.status(202).json({
      id: prediction.id,
      status: prediction.status
    });
  } catch (error) {
    console.error("Video creation error:", error.message);
    res.status(502).json({
      error: "Video yaratilmadi. API token, hisob va model mavjudligini tekshiring."
    });
  }
});

app.get("/api/videos/:id", async (req, res) => {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(500).json({ error: "API token ulanmagan." });
  }

  try {
    const replicate = new Replicate({ auth: token });
    const prediction = await replicate.predictions.get(req.params.id);

    res.json({
      id: prediction.id,
      status: prediction.status,
      output: prediction.output ?? null,
      error: prediction.error ?? null
    });
  } catch (error) {
    res.status(502).json({
      error: "Video holatini tekshirib bo‘lmadi."
    });
  }
});

app.use(express.static(path.join(root, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(root, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`AI video server ${port}-portda ishga tushdi`);
});
