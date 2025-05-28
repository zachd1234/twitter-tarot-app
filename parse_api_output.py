#!/usr/bin/env python3
import json
import sys

def extract_fields(json_data):
    """Extract and display each field from the API response"""
    
    print("=" * 60)
    print("API RESPONSE FIELD EXTRACTION")
    print("=" * 60)
    
    # Extract Card Information
    if 'card' in json_data:
        card = json_data['card']
        print("\n🃏 TAROT CARD INFORMATION:")
        print("-" * 30)
        if 'card_name' in card:
            print(f"Card Name: {card['card_name']}")
        if 'symbol' in card:
            print(f"Symbol: {card['symbol']}")
        if 'interpretation' in card:
            print(f"Interpretation: {card['interpretation']}")
    
    # Extract Personality Signal
    if 'personality_signal' in json_data:
        print("\n🧠 PERSONALITY SIGNAL:")
        print("-" * 30)
        print(json_data['personality_signal'])
    
    # Extract Twitter Data (if present)
    if 'twitter_data' in json_data:
        print("\n🐦 TWITTER DATA:")
        print("-" * 30)
        print(json_data['twitter_data'])
    
    # Extract Image Generation Data
    if 'Image generation' in json_data:
        img_data = json_data['Image generation']
        print("\n🎨 IMAGE GENERATION:")
        print("-" * 30)
        if 'output' in img_data and 'image_url' in img_data['output']:
            print(f"Generated Image URL: {img_data['output']['image_url']}")
        if 'output' in img_data and 'type' in img_data['output']:
            print(f"Output Type: {img_data['output']['type']}")
    
    # Extract any other top-level fields
    print("\n📋 ALL TOP-LEVEL FIELDS:")
    print("-" * 30)
    for key in json_data.keys():
        print(f"- {key}")
    
    print("\n" + "=" * 60)

def main():
    if len(sys.argv) > 1:
        # Read from file if provided
        try:
            with open(sys.argv[1], 'r') as f:
                json_str = f.read()
        except FileNotFoundError:
            print(f"Error: File '{sys.argv[1]}' not found")
            return
    else:
        # Read from stdin
        print("Paste your JSON output and press Ctrl+D (or Ctrl+Z on Windows) when done:")
        json_str = sys.stdin.read()
    
    try:
        # Parse the JSON
        data = json.loads(json_str)
        extract_fields(data)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print("Please ensure you've pasted valid JSON data")

if __name__ == "__main__":
    main() 