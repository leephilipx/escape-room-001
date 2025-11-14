# Escape Room 001: The Hourglass of Life

A hybrid digital-physical escape room experience where players uncover clues, scan portals, solve puzzles, and progress through puzzle-driven phases. This repository contains the clues, frontend app, backend API, and deployment configurations used to run the full interactive game.

## 📘 Idea

See the full concept in [./IDEA.md](./IDEA.md)

---

## 🚀 Local Development

### Frontend

```bash
npm install
npm run dev
```

An `example.env` file is provided in the frontend directory; copy it to `.env` and fill in the required values.

### Backend

```bash
pip install -r requirements.txt
python main.py
```

The backend also includes an `example.env`; duplicate it as `.env` before starting local development or deployment.

## 🛠 Deployment

### Frontend

```bash
npm run build
```

The frontend build output (`dist/`) can be hosted as a static website on Amazon S3.

### Backend

This project supports deployment via the AWS Lambda Web Adapter:  
https://github.com/awslabs/aws-lambda-web-adapter

Build Python dependencies for Lambda layer:

```bash
pip install -t python -r requirements.txt --platform manylinux2014_x86_64 --only-binary=:all:
```

You will also need to create the required S3 buckets (for static hosting and/or asset storage) and DynamoDB tables (for game state and persistent data).

---

## Acknowledgements

- **Storyline:** ChatGPT
- **Intro Video:** Clipchamp, Lyria 2, Veo 3.1
- **Hourglass Realm Portal:** AWS, ChatGPT, Claude Haiku 4.5, Gemini 2.5 Flash, Imagen 4
- **Audio Tracks:** Adrift Among Infinite Stars by Scott Buckley (CC-BY-4.0), Journey by Roa (CC-BY-4.0)
