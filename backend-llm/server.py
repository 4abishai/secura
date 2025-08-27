from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import json

from summary import generate_summaries

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

def call_groq_llm(query, model="llama-3.3-70b-versatile"):
    """
    Function to call Groq API and get response from Llama model
    """
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
                "content": "You are a helpful AI assistant. Provide concise, accurate answers. Keep responses brief and to the point."
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

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "Groq API Backend is running",
        "port": 3001
    })

@app.route('/api/chat', methods=['POST'])
def chat_with_groq():
    """
    Main endpoint to chat with Groq LLM
    Expects JSON payload with 'query' field
    """
    try:
        print("Called /api/chat endpoint")
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({
                "success": False,
                "error": "Query field is required and cannot be empty"
            }), 400
        
        # Get optional model parameter (defaults to Llama 3.3 70B)
        model = data.get('model', 'llama-3.3-70b-versatile')
        
        # Call Groq API
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
                "error": result['error'],
                "response": ""
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}",
            "response": ""
        }), 500

@app.route('/api/chat/llama4', methods=['POST'])
def chat_with_llama4():
    """
    Specific endpoint for Llama 4 Maverick model
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({
                "success": False,
                "error": "Query field is required and cannot be empty"
            }), 400
        
        # Use Llama 4 Maverick model specifically
        model = "meta-llama/llama-4-maverick-17b-128e-instruct"
        
        # Call Groq API with Llama 4 Maverick
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
                "error": result['error'],
                "response": ""
            }), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}",
            "response": ""
        }), 500

@app.route('/api/models', methods=['GET'])
def get_available_models():
    """
    Endpoint to get available Groq models
    """
    """
    Endpoint to get available Groq models (Production models only)
    """
    models = [
        "llama-3.3-70b-versatile",      # Production - Latest Llama 3.3 70B
        "llama-3.1-8b-instant",        # Production - Fast 8B model
        "gemma2-9b-it"                  # Production - Google's Gemma2 9B
    ]
    
    return jsonify({
        "success": True,
        "models": models,
        "default": "llama-3.3-70b-versatile",
        "preview_models": [
            "meta-llama/llama-4-maverick-17b-128e-instruct",  # Preview - Llama 4 Maverick
            "meta-llama/llama-4-scout-17b-16e-instruct",      # Preview - Llama 4 Scout
            "deepseek-r1-distill-llama-70b",                  # Preview - DeepSeek R1
            "qwen/qwen3-32b",                                  # Preview - Qwen 3 32B
            "moonshotai/kimi-k2-instruct"                      # Preview - Kimi K2
        ]
    })

@app.route('/api/summarize', methods=['POST'])
def summarize_text():
    """
    Endpoint to summarize text using Groq LLM
    """
    try:
        data = request.get_json()
        messages = data.get('text', [])

        if not messages:
            return jsonify({
                "success": False,
                "error": "No messages provided"
            }), 400

        # Join all messages into a single conversation-like text
        text = "\n".join(
            [f"{msg.get('sender', 'Unknown')}: {msg.get('content', '')}" for msg in messages]
        )

        # Build summarization prompt
        prompt = f"""
        Summarize the following conversation in clear, concise language.
        Focus on key points, decisions, and important details. Avoid redundancy.

        Conversation:
        {text}
        """

        # Call Groq API
        result = call_groq_llm(prompt, model="llama-3.3-70b-versatile")

        if result['success']:
            return jsonify({
                "success": True,
                "summary": result['response'],
                "model": result['model'],
                "usage": result.get('usage', {})
            })
        else:
            return jsonify({
                "success": False,
                "error": result['error'],
                "summary": ""
            }), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "summary": ""
        }), 500


@app.route('/api/chat/stream', methods=['POST'])
def chat_with_groq_stream():
    """
    Streaming endpoint for chat (if needed for real-time responses)
    """
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({
                "success": False,
                "error": "Query is required"
            }), 400
        
        # For now, return non-streaming response
        # You can implement Server-Sent Events (SSE) here if needed
        result = call_groq_llm(query)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500

if __name__ == '__main__':
    # Check if GROQ_API_KEY is available
    if not GROQ_API_KEY:
        print("WARNING: GROQ_API_KEY not found in environment variables!")
        print("Please set GROQ_API_KEY or VITE_GROQ_API_KEY in your .env file")
    else:
        print("✓ GROQ_API_KEY found")
    
    print("Starting Flask server on localhost:3001")
    print("Available endpoints:")
    print("  GET  /              - Health check")
    print("  POST /api/chat      - Chat with Groq LLM (default: Llama 3.3)")

    # Run the Flask app
    app.run(
        host='localhost',
        port=3001,
        debug=True,
        threaded=True
    )
