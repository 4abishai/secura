from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import json

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
