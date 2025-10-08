// ========================================
// GAME OF THRONES VOICE CHATBOT - FRONTEND
// ========================================

// 1️⃣ GLOBAL STATE
// These variables track the app's current state
let selectedCharacter = null;           // Currently selected character
let mediaRecorder = null;               // Browser's audio recorder
let audioChunks = [];                   // Stores recorded audio data
let isRecording = false;                // Is user currently recording?
let isProcessing = false;               // Is backend processing something?

// 2️⃣ DOM ELEMENTS
// Get references to HTML elements (wait for page to load)
document.addEventListener('DOMContentLoaded', () => {
  
  // Character selection buttons
  const characterButtons = document.querySelectorAll('.character-btn');
  const characterSelection = document.querySelector('.character-selection');
  const chatInterface = document.querySelector('.chat-interface');
  
  // Chat elements
  const recordBtn = document.getElementById('record-btn');
  const statusDiv = document.getElementById('status');
  const chatMessages = document.getElementById('chat-messages');
  const transcriptDiv = document.getElementById('transcript');
  const transcriptText = document.getElementById('transcript-text');
  const currentCharacterName = document.getElementById('current-character-name');

  // 3️⃣ CHARACTER SELECTION LOGIC
  characterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Get character ID from button's data attribute
      selectedCharacter = btn.getAttribute('data-character');
      
      // Visual feedback: highlight selected character
      characterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show chat interface, hide character selection
      characterSelection.style.display = 'none';
      chatInterface.style.display = 'block';
      
      // Update character name display
      const characterName = btn.querySelector('.character-name').textContent;
      currentCharacterName.textContent = characterName;
      
      // Add greeting message
      addSystemMessage(`${characterName} is ready to speak with you.`);
      
      console.log(`✅ Selected character: ${selectedCharacter}`);
    });
  });

  // 4️⃣ RECORDING BUTTON LOGIC
  recordBtn.addEventListener('click', async () => {
    
    if (isProcessing) {
      return; // Ignore clicks while processing
    }
    
    if (!isRecording) {
      // START RECORDING
      await startRecording();
    } else {
      // STOP RECORDING
      await stopRecording();
    }
  });

  // 5️⃣ START RECORDING FUNCTION
  async function startRecording() {
    try {
      // Request microphone permission from browser
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder (browser's built-in audio recorder)
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      // Event: when audio data is available, save it
      mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
      });
      
      // Event: when recording stops, process the audio
      mediaRecorder.addEventListener('stop', async () => {
        // Stop microphone stream (turn off mic light)
        stream.getTracks().forEach(track => track.stop());
        
        // Convert audio chunks into a single audio file
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Process the recorded audio
        await processAudio(audioBlob);
      });
      
      // Start recording
      mediaRecorder.start();
      isRecording = true;
      
      // Update UI
      updateStatus('🔴 Recording... Click to stop', 'recording');
      recordBtn.classList.add('recording');
      recordBtn.querySelector('.record-text').textContent = 'Stop Recording';
      
      console.log('🎙️ Recording started');
      
    } catch (error) {
      console.error('❌ Microphone error:', error);
      alert('Could not access microphone. Please allow microphone permissions.');
    }
  }

  // 6️⃣ STOP RECORDING FUNCTION
  async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      isRecording = false;
      
      // Update UI
      recordBtn.classList.remove('recording');
      recordBtn.querySelector('.record-text').textContent = 'Start Recording';
      
      console.log('🛑 Recording stopped');
    }
  }

  // 7️⃣ PROCESS AUDIO (Main workflow)
  async function processAudio(audioBlob) {
    isProcessing = true;
    recordBtn.disabled = true;
    
    try {
      // STEP 1: TRANSCRIBE (Audio → Text)
      updateStatus('⏳ Transcribing your message...', 'processing');
      const transcription = await transcribeAudio(audioBlob);
      
      // Show what user said
      transcriptText.textContent = transcription;
      transcriptDiv.style.display = 'block';
      addUserMessage(transcription);
      
      // STEP 2: GENERATE RESPONSE (Text → AI Response)
      updateStatus(`🧠 ${currentCharacterName.textContent} is thinking...`, 'processing');
      const response = await generateResponse(transcription);
      
      // Show character's response as text
      addCharacterMessage(response.text);
      
      // STEP 3: TEXT-TO-SPEECH (Text → Audio)
      updateStatus(`🔊 Speaking...`, 'speaking');
      await speakResponse(response.text);
      
      // DONE!
      updateStatus('✅ Ready to record', 'ready');
      
    } catch (error) {
      console.error('❌ Processing error:', error);
      updateStatus('❌ Error occurred. Please try again.', 'error');
      addSystemMessage('Error processing your message. Please try again.');
    } finally {
      isProcessing = false;
      recordBtn.disabled = false;
      
      // Hide transcript after a moment
      setTimeout(() => {
        transcriptDiv.style.display = 'none';
      }, 3000);
    }
  }

  // 8️⃣ API CALL: TRANSCRIBE AUDIO
  async function transcribeAudio(audioBlob) {
    // Create FormData (special format for file uploads)
    const formData = new FormData();
    
    // IMPORTANT: Specify correct MIME type and extension
    // WebM is supported by Whisper, but we need to be explicit
    const audioFile = new File([audioBlob], 'recording.webm', { 
      type: 'audio/webm' 
    });
    formData.append('audio', audioFile);
    
    // Send to backend
    const response = await fetch('http://localhost:3000/api/transcribe', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Transcription error:', error);
      throw new Error('Transcription failed');
    }
    
    const data = await response.json();
    console.log('📝 Transcription:', data.text);
    return data.text;
  }

  // 9️⃣ API CALL: GENERATE RESPONSE
  async function generateResponse(text) {
    const response = await fetch('http://localhost:3000/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        character: selectedCharacter
      })
    });
    
    if (!response.ok) {
      throw new Error('Response generation failed');
    }
    
    const data = await response.json();
    console.log('🧠 Response:', data.text);
    return data;
  }

  // 🔟 API CALL: TEXT-TO-SPEECH
  async function speakResponse(text) {
    const response = await fetch('http://localhost:3000/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        character: selectedCharacter
      })
    });
    
    if (!response.ok) {
      throw new Error('TTS failed');
    }
    
    // Get audio data as blob
    const audioBlob = await response.blob();
    
    // Create audio URL and play it
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Wait for audio to finish playing
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl); // Clean up memory
        resolve();
      };
      audio.onerror = reject;
      audio.play();
    });
  }

  // 1️⃣1️⃣ UI HELPER: UPDATE STATUS
  function updateStatus(message, state) {
    statusDiv.textContent = message;
    statusDiv.className = 'status'; // Reset classes
    
    if (state === 'recording') {
      statusDiv.classList.add('recording');
    } else if (state === 'processing') {
      statusDiv.classList.add('processing');
    } else if (state === 'speaking') {
      statusDiv.classList.add('speaking');
    }
  }

  // 1️⃣2️⃣ UI HELPER: ADD USER MESSAGE
  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `<strong>You:</strong> ${text}`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 1️⃣3️⃣ UI HELPER: ADD CHARACTER MESSAGE
  function addCharacterMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message character-message';
    messageDiv.innerHTML = `<strong>${currentCharacterName.textContent}:</strong> ${text}`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 1️⃣4️⃣ UI HELPER: ADD SYSTEM MESSAGE
  function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

});

// 1️⃣5️⃣ CHANGE CHARACTER FUNCTION (Global scope for HTML onclick)
function changeCharacter() {
  location.reload(); // Simple way to reset and choose new character
}