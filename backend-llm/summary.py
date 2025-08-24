# summary.py
from transformers import pipeline
from summarizer import Summarizer

# Load models once
bart_summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
bert_model = Summarizer()

def generate_summaries(text: str):
    """Generate summaries using both BART (abstractive) and BERT (extractive)."""
    if not text.strip():
        return {"bart_summary": "", "bert_summary": ""}

    # BART abstractive summary
    bart_summary = bart_summarizer(text, max_length=130, min_length=30, do_sample=False)
    bart_result = bart_summary[0]['summary_text']

    # BERT extractive summary
    bert_result = bert_model(text, min_length=60)
    if isinstance(bert_result, list):
        bert_result = " ".join(bert_result)

    return {
        "bart_summary": bart_result,
        "bert_summary": bert_result
    }
