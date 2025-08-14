from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import json
from groq import Groq

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
GROQ_API_KEY = os.getenv('GROQ_API_KEY') or os.getenv('VITE_GROQ_API_KEY')
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# ------------------- LLM CHAT FUNCTION -------------------
def call_groq_llm(query, model="llama-3.3-70b-versatile"):
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not found in environment variables")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful AI assistant. Provide concise, accurate answers. Keep responses brief."
            },
            {
                "role": "user",
                "content": query
            }
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()

        data = response.json()
        if 'choices' in data and len(data['choices']) > 0:
            return {
                "success": True,
                "response": data['choices'][0]['message']['content'],
                "model": model,
                "usage": data.get('usage', {})
            }
        else:
            return {
                "success": False,
                "error": "No response from Groq API",
                "response": ""
            }

    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Request failed: {str(e)}",
            "response": ""
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "response": ""
        }

# ------------------- HEALTH CHECK -------------------
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Groq API Backend is running",
        "port": 3001
    })

# ------------------- CHAT ENDPOINTS -------------------
@app.route('/api/chat', methods=['POST'])
def chat_with_groq():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400

        query = data.get('query', '').strip()
        if not query:
            return jsonify({"success": False, "error": "Query field is required"}), 400

        model = data.get('model', 'llama-3.3-70b-versatile')
        result = call_groq_llm(query, model)

        if result['success']:
            return jsonify({
                "success": True,
                "response": result['response'],
                "model": result['model'],
                "usage": result.get('usage', {})
            })
        else:
            return jsonify({
                "success": False,
                "error": result['error']
            }), 500

    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

@app.route('/api/chat/llama4', methods=['POST'])
def chat_with_llama4():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400

        query = data.get('query', '').strip()
        if not query:
            return jsonify({"success": False, "error": "Query field is required"}), 400

        model = "meta-llama/llama-4-maverick-17b-128e-instruct"
        result = call_groq_llm(query, model)

        if result['success']:
            return jsonify({
                "success": True,
                "response": result['response'],
                "model": result['model'],
                "usage": result.get('usage', {}),
                "note": "Using Llama 4 Maverick (Preview model)"
            })
        else:
            return jsonify({
                "success": False,
                "error": result['error']
            }), 500

    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

@app.route('/api/models', methods=['GET'])
def get_available_models():
    models = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "gemma2-9b-it"
    ]
    return jsonify({
        "success": True,
        "models": models,
        "default": "llama-3.3-70b-versatile",
        "preview_models": [
            "meta-llama/llama-4-maverick-17b-128e-instruct",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "deepseek-r1-distill-llama-70b",
            "qwen/qwen3-32b",
            "moonshotai/kimi-k2-instruct"
        ]
    })

@app.route('/api/chat/stream', methods=['POST'])
def chat_with_groq_stream():
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        if not query:
            return jsonify({"success": False, "error": "Query is required"}), 400

        result = call_groq_llm(query)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------- SPEECH TO TEXT -------------------
@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """
    Accepts an audio file from frontend and transcribes it using Groq Whisper.
    """
    try:
        # Check if audio file is present in the request
        if "audio" not in request.files:
            print("Audio file not found in request")
            return jsonify({"success": False, "error": "No audio file uploaded"}), 400

        audio_file = request.files["audio"]
        
        # Check if a file was actually selected
        if audio_file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        # Validate file type (optional but recommended)
        allowed_extensions = {'wav', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'}
        file_ext = audio_file.filename.rsplit('.', 1)[1].lower() if '.' in audio_file.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({
                "success": False, 
                "error": f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            }), 400
        
        print(f"Processing audio file: {audio_file.filename}")
        
        # Create transcription using Groq Whisper
        transcription = groq_client.audio.transcriptions.create(
            file=(audio_file.filename, audio_file.stream, audio_file.content_type),
            model="whisper-large-v3",
            response_format="text"  # or "json" for more detailed response
        )
        
        print(f"Transcription completed: {transcription[:100]}...")  # Log first 100 chars
        
        return jsonify({
            "success": True,
            "text": transcription
        })

    except Exception as e:
        print(f"Error in speech-to-text: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Transcription failed: {str(e)}"
        }), 500
    
# ------------------- ERROR HANDLERS -------------------
@app.errorhandler(404)
def not_found(error):
    print("\n[404 ERROR] Endpoint not found")
    print(f"\nMethodURL: {request.url}")
    print(f"\nMethodMethod: {request.method}")
    print(f"\nMethodQuery Params: {request.args.to_dict()}")
    print(f"\nMethodClient IP: {request.remote_addr}")
    print(f"\nMethodHeaders: {dict(request.headers)}")
    
    return jsonify({
        "success": False,
        "error": "Endpoint not found",
        "path": request.path,
        "method": request.method
    }), 404

@app.errorhandler(500)
def internal_error(error):
    print("\n[500 ERROR] Internal server error")
    print(f"\nURL: {request.url}")
    print(f"\nMethod: {request.method}")
    print(f"\nMethodQuery Params: {request.args.to_dict()}")
    print(f"\nMethodClient IP: {request.remote_addr}")
    print(f"\nMethodHeaders: {dict(request.headers)}")
    print(f"\nMethodError Type: {type(error).__name__}")
    print(f"\nMethodError Details: {str(error)}")

    return jsonify({
        "success": False,
        "error": "Internal server error",
        "path": request.path,
        "method": request.method
    }), 500

# ------------------- MAIN -------------------
if __name__ == '__main__':
    if not GROQ_API_KEY:
        print("WARNING: GROQ_API_KEY not found in environment variables!")
    else:
        print("✓ GROQ_API_KEY found")

    print("Starting Flask server on localhost:3001")
    print("Available endpoints:")
    print("  GET  /                      - Health check")
    print("  POST /api/chat              - Chat with Groq LLM")
    print("  POST /api/chat/llama4       - Chat with Llama 4 Maverick")
    print("  GET  /api/models            - Get available models")
    print("  POST /api/chat/stream       - Streaming chat")
    print("  POST /api/speech-to-text    - Transcribe audio with Whisper")

    app.run(
        host='localhost',
        port=3001,
        debug=True,
        threaded=True
    )
