# Game of Thrones — Voice Chatbot

Lightweight Node.js backend + simple frontend that lets you speak to Game of Thrones characters. Your audio is transcribed, the AI composes a character-specific reply, and the reply is returned as spoken audio using OpenAI's speech and chat APIs.

## Features

- Record or upload voice from the browser and transcribe speech to text (Whisper).
- Generate characterful replies using GPT (character system prompts are included).
- Convert text responses back to audio (TTS) so the character speaks.
- Built-in example characters: Jon Snow, Daenerys Targaryen, and Sansa Stark.

## How it works (high level)

1. Frontend records or uploads an audio clip and POSTs it to `/api/transcribe`.
2. Server transcribes audio using OpenAI Whisper and returns the text.
3. Frontend sends the transcribed text and desired character to `/api/respond`.
4. Server generates a short reply constrained by the character's system prompt.
5. Frontend requests `/api/tts` with text + character; server returns spoken audio.

## Prerequisites

- Node.js (v16+ recommended)
- An OpenAI API key with access to the required models (set in a `.env` file)

## Install

Clone the repo (if you haven't already), then from the project root:

```bash
npm install
```

Create a `.env` file in the project root with:

```text
OPENAI_API_KEY=sk-...your-openai-key...
```

## Run

Start the server:

```bash
npm start
# or
node server.js
```

By default the server listens on http://localhost:3000 and serves the static frontend from the `public/` folder.

## API Endpoints

- POST /api/transcribe
  - Accepts form-data with a single file field named `audio`.
  - Returns JSON: `{ text: "transcribed text" }`.

  Example (curl):
  ```bash
  curl -X POST -F "audio=@/path/to/clip.webm" http://localhost:3000/api/transcribe
  ```

- POST /api/respond
  - Body JSON: `{ "text": "...user text...", "character": "jon-snow" }`.
  - Returns JSON: `{ text: "character reply", character: "Character Name" }`.

- POST /api/tts
  - Body JSON: `{ "text": "...reply text...", "character": "jon-snow" }`.
  - Returns audio (MP3) as binary response with `Content-Type: audio/mpeg`.

## Characters

Defined server-side in `server.js` under `CHARACTER_PROMPTS`. Current IDs you can pass as the `character` value:

- `jon-snow` — Jon Snow
- `daenerys` — Daenerys Targaryen
- `sansa` — Sansa Stark

You can extend or modify characters by editing `server.js`.

## Project structure

- `server.js` — Express backend (transcription, response generation, TTS).
- `package.json` — Dependencies (Express, multer, openai, etc.).
- `public/` — Static frontend (client.js, index.html, style.css).
- `uploads/` — Temporary uploaded audio files (gitignored content).

## Notes & tips

- The server renames uploaded files to include the original extension. Temporary files are deleted after transcription.
- Keep responses short to save API usage — the backend limits generated tokens.
- If you add a reverse proxy, update ports and CORS as needed.

## Contributing

Small fixes, additional characters, or a nicer frontend are welcome. Open a PR with a clear description.

## License

This repository does not include a license file. Add one if you plan to publish.

---

If you'd like, I can also add a `start` script to `package.json`, add a small CONTRIBUTING.md, or wire up a prettier README badge — tell me which next.
