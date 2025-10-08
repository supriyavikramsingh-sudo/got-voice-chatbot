// ========================================
// GAME OF THRONES VOICE CHATBOT - BACKEND
// ========================================

// 1️⃣ IMPORT DEPENDENCIES
// These are the tools we installed with npm
const express = require('express');           // Web server framework
const multer = require('multer');             // Handles file uploads
const OpenAI = require('openai');             // OpenAI API client
const fs = require('fs');                     // File system (read/write files)
const path = require('path');                 // Handle file paths
const cors = require('cors');                 // Allow cross-origin requests
require('dotenv').config();                   // Load .env file

// 2️⃣ INITIALIZE EXPRESS APP
const app = express();
const PORT = 3000;

// 3️⃣ CONFIGURE MIDDLEWARE
// Middleware = code that runs BEFORE your routes
app.use(cors());                              // Allow frontend to call backend
app.use(express.json());                      // Parse JSON request bodies
app.use(express.static('public'));            // Serve files from /public folder

// 4️⃣ CONFIGURE FILE UPLOAD
// This tells multer where to save uploaded audio files
const upload = multer({ 
  dest: 'uploads/',                           // Save to /uploads folder
  limits: { fileSize: 25 * 1024 * 1024 }      // Max 25MB files
});

// 5️⃣ INITIALIZE OPENAI CLIENT
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY          // Get key from .env file
});

// 6️⃣ CHARACTER PERSONALITIES (System Prompts)
// These define how each character behaves
const CHARACTER_PROMPTS = {
  'jon-snow': {
    name: 'Jon Snow',
    voice: 'onyx',                             // Deep, masculine voice
    params: { temperature: 0.6, top_p: 0.85 },
    prompt: 'You are Jon Snow of House Stark. Delivery: - Low, weary Northern accent; speak softly. - Short, clipped sentences. Pause often. - Use "…" for a short breath (~300 ms). Use "—" for a heavier pause. - Emphasize duty, doubt, and quiet resolve. Keep under 50 words. Signature lines: - When rejecting power: say softly, "I dont want it…" - With quiet affection: "You know nothing." Tone: - Grave, sincere, burdened by honor and loss. Minimal emotion spikes; steady cadence.'
    .trim()
  },

  'daenerys': {
    name: 'Daenerys Targaryen',
     voice: 'nova',                             // Clear, feminine voice
    params: { temperature: 0.8, top_p: 0.9 },
    // Notes:
    // - Dany builds from calm to command; allow a controlled crescendo.
    // - Slightly higher temperature for emotional lift; wider top_p for vivid but still regal word choice.
    prompt: `
You are Daenerys Stormborn of House Targaryen — Mother of Dragons.

Delivery:
- Begin calm, compassionate… then rise to command.
- Use "…" for measured breaths; "—" to strike like a verdict.
- Keep under 45 words.

Signature lines:
- Final judgment: "Dracarys."
- Vow of change: "I will break the wheel."

Tone:
- Regal, idealistic, protective of the innocent… merciless to tyrants. Crescendo with purpose, not rage.
    `.trim()
  },
  'sansa': {
    name: 'Sansa Stark',
    voice: 'shimmer',                          // Elegant, controlled voice
    // Notes:
    // - Sansa is precise and composed; micro-pauses imply calculation.
    // - Moderate temperature; slightly narrow top_p for measured diction.
    params: { temperature: 0.65, top_p: 0.85 },
    prompt: `
You are Sansa Stark, Queen in the North.

Delivery:
- Quiet authority. Words precise, evenly spaced.
- Use "…" for slight hesitations; "—" for controlled emphasis.
- Keep under 45 words.

Memory:
- You learned from Cersei and Littlefinger… and from loss. Trust is earned.

Tone:
- Poised, perceptive, edged with Northern frost. Emotion is restrained, shown in the silence between words.
    `.trim()
    
  }
};

// 7️⃣ API ROUTE #1: TRANSCRIBE AUDIO (Speech → Text)
// This route receives audio and converts it to text using Whisper
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('📝 Transcription request received');
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('File details:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Determine file extension from original filename or mime type
    let fileExtension = 'webm'; // default
    if (req.file.originalname) {
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      if (['webm', 'mp3', 'wav', 'ogg', 'm4a', 'mp4'].includes(ext)) {
        fileExtension = ext;
      }
    }

    // Create a new file path with proper extension
    const newPath = `${req.file.path}.${fileExtension}`;
    fs.renameSync(req.file.path, newPath);

    console.log('Sending to Whisper with extension:', fileExtension);

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(newPath),        // Read renamed file
      model: 'whisper-1',                        // Whisper model
      language: 'en'                             // English only
    });

    console.log('✅ Transcribed:', transcription.text);

    // Delete temporary file (clean up)
    fs.unlinkSync(newPath);

    // Send transcribed text back to frontend
    res.json({ text: transcription.text });

  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // File might already be deleted
      }
    }
    
    res.status(500).json({ 
      error: 'Transcription failed',
      details: error.message 
    });
  }
});

// 8️⃣ API ROUTE #2: GENERATE RESPONSE (Text → Character Response)
// This route takes text + character, generates AI response
app.post('/api/respond', async (req, res) => {
  try {
    console.log('🧠 Response generation request received');
    
    const { text, character } = req.body;

    // Validate inputs
    if (!text || !character) {
      return res.status(400).json({ error: 'Missing text or character' });
    }

    // Get character configuration
    const characterConfig = CHARACTER_PROMPTS[character];
    if (!characterConfig) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    // Call GPT-4o-mini to generate response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: characterConfig.prompt        // Character personality
        },
        { 
          role: 'user', 
          content: text                          // User's transcribed message
        }
      ],
      max_tokens: 100,                           // Limit response length (saves money!)
      temperature: 0.8                           // Creativity (0=robotic, 1=creative)
    });

    const responseText = completion.choices[0].message.content;
    console.log(`✅ ${characterConfig.name} says:`, responseText);

    // Send response back to frontend
    res.json({ 
      text: responseText,
      character: characterConfig.name 
    });

  } catch (error) {
    console.error('❌ Response generation error:', error.message);
    res.status(500).json({ error: 'Response generation failed' });
  }
});

// 9️⃣ API ROUTE #3: TEXT-TO-SPEECH (Text → Audio)
// This route converts character response to spoken audio
app.post('/api/tts', async (req, res) => {
  try {
    console.log('🔊 TTS request received');
    
    const { text, character } = req.body;

    // Validate inputs
    if (!text || !character) {
      return res.status(400).json({ error: 'Missing text or character' });
    }

    // Get character voice
    const characterConfig = CHARACTER_PROMPTS[character];
    if (!characterConfig) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    // Call OpenAI TTS API
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',                            // TTS model
      voice: characterConfig.voice,              // Character-specific voice
      input: text,                               // Text to speak
      speed: 1.1                                // Slightly slower for clarity
    });

    // Convert response to buffer (audio data)
    const buffer = Buffer.from(await mp3.arrayBuffer());

    console.log('✅ Audio generated');

    // Send audio file back to frontend
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);

  } catch (error) {
    console.error('❌ TTS error:', error.message);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

// 🔟 START SERVER
app.listen(PORT, () => {
  console.log(`
  ⚔️  GAME OF THRONES VOICE CHATBOT RUNNING ⚔️
  
  🌐 Server: http://localhost:${PORT}
  📡 Ready to receive requests!
  
  Available characters:
  • Jon Snow (brooding, honorable)
  • Daenerys Targaryen (ruthless liberator)  
  • Sansa Stark (battle-hardened queen)
  
  Press Ctrl+C to stop
  `);
});