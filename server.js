import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Replicate from "replicate";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("Missing REPLICATE_API_TOKEN. Copy .env.example to .env and add your token.");
  process.exit(1);
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "20kb" }));
app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Жуда кўп сўров юборилди. Бир дақиқадан кейин қайта урининг." }
}));

const ownedPredictions = new Set();

function mapStyle(style) {
  if (style === "Кино") return "cinematic film look, dramatic lighting";
  if (style === "Мультфильм") return "stylized 3D cartoon animation";
  if (style === "Реалистик") return "photorealistic, natural lighting";
  if (style === "Анимэ") return "anime animation style";
  return "";
}

app.post("/api/videos", async (req, res) => {
  try {
    const rawPrompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const duration = Number(req.body?.duration);
    const aspectRatio = req.body?.aspectRatio;
    if (rawPrompt.length < 5 || rawPrompt.length > 1200) {
      return res.status(400).json({ error: "Видео ғояси 5–1200 белгидан иборат бўлиши керак." });
    }
    if (![5, 8, 10, 15].includes(duration)) {
      return res.status(400).json({ error: "Давомийлик 5, 8, 10 ёки 15 сония бўлиши керак." });
    }
    if (!["9:16", "1:1", "16:9"].includes(aspectRatio)) {
      return res.status(400).json({ error: "Видео формати нотўғри." });
    }

    // PixVerse V6 supports text-to-video, these durations and aspect ratios.
    // Use a low-resolution, no-audio preset to keep the initial cost lower.
    const prediction = await replicate.predictions.create({
      model: "pixverse/pixverse-v6",
      input: {
        prompt: rawPrompt,
        duration,
        aspect_ratio: aspectRatio,
        quality: "360p",
        generate_audio_switch: false
      }
    });

    ownedPredictions.add(prediction.id);
    return res.status(202).json({ id: prediction.id, status: prediction.status });
  } catch (err) {
    console.error("Replicate create error:", err?.message || err);
    return res.status(502).json({ error: "Replicate сўровини яратиб бўлмади. API токени, ҳисоб ва модел ҳолатини текширинг." });
  }
});

app.get("/api/videos/:id", async (req, res) => {
  const id = req.params.id;
  // Restrict status checks to IDs created by this server process.
  if (!ownedPredictions.has(id)) {
    return res.status(404).json({ error: "Бу серверда бундай видео сўрови топилмади. Янги сўров яратинг." });
  }
  try {
    const prediction = await replicate.predictions.get(id);
    return res.json({
      id: prediction.id,
      status: prediction.status,
      output: prediction.output ?? null,
      error: prediction.status === "failed" ? "Модель видео ярата олмади. Бошқа промпт билан қайта урининг." : null
    });
  } catch (err) {
    console.error("Replicate status error:", err?.message || err);
    return res.status(502).json({ error: "Видео ҳолатини Replicate орқали текшириб бўлмади." });
  }
});

app.use(express.static(publicDir));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.listen(port, () => console.log(`Клип сервери ишлаяпти: http://localhost:${port}`));
