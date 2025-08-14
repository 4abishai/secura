import React, { useState } from 'react';

const SpeechRecorder = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setAudioChunks([]);
      recorder.ondataavailable = e => {
        if (e.data.size > 0) setAudioChunks(prev => [...prev, e.data]);
      };
      recorder.onstop = sendAudioForTranscription;
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const sendAudioForTranscription = async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    try {
      const res = await fetch("http://localhost:3001/api/speech-to-text", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.text) {
        onTranscriptionComplete(data.text);
      }
    } catch (err) {
      console.error("Error transcribing audio:", err);
    }
  };

  return (
    <div>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={{
          backgroundColor: isRecording ? 'red' : 'blue',
          color: 'white',
          padding: '8px 12px',
          border: 'none',
          borderRadius: '5px'
        }}
      >
        {isRecording ? '⏹ Stop Recording' : '🎙 Start Recording'}
      </button>
    </div>
  );
};

export default SpeechRecorder;
