#!/usr/bin/env python3
import json
import sys

def extract_to_variables(json_data):
    """Extract each field from the API response as separate variables"""
    
    # Initialize variables
    card_name = None
    card_symbol = None
    card_interpretation = None
    personality_signal = None
    twitter_data = None
    image_url = None
    image_type = None
    
    # Extract Card Information
    if 'card' in json_data:
        card = json_data['card']
        card_name = card.get('card_name')
        card_symbol = card.get('symbol')
        card_interpretation = card.get('interpretation')
    
    # Extract Personality Signal
    personality_signal = json_data.get('personality_signal')
    
    # Extract Twitter Data
    twitter_data = json_data.get('twitter_data')
    
    # Extract Image Generation Data
    if 'Image generation' in json_data:
        img_data = json_data['Image generation']
        if 'output' in img_data:
            image_url = img_data['output'].get('image_url')
            image_type = img_data['output'].get('type')
    
    return {
        'card_name': card_name,
        'card_symbol': card_symbol,
        'card_interpretation': card_interpretation,
        'personality_signal': personality_signal,
        'twitter_data': twitter_data,
        'image_url': image_url,
        'image_type': image_type
    }

def display_variables(variables):
    """Display each variable separately"""
    
    print("=" * 60)
    print("EXTRACTED VARIABLES")
    print("=" * 60)
    
    print(f"\ncard_name = {repr(variables['card_name'])}")
    print(f"\ncard_symbol = {repr(variables['card_symbol'])}")
    print(f"\ncard_interpretation = {repr(variables['card_interpretation'])}")
    print(f"\npersonality_signal = {repr(variables['personality_signal'])}")
    print(f"\ntwitter_data = {repr(variables['twitter_data'])}")
    print(f"\nimage_url = {repr(variables['image_url'])}")
    print(f"\nimage_type = {repr(variables['image_type'])}")
    
    print("\n" + "=" * 60)
    print("USAGE EXAMPLES:")
    print("=" * 60)
    print("# Access individual fields:")
    print("print(card_name)")
    print("print(card_interpretation)")
    print("print(image_url)")
    print("# etc...")

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
        
        # Extract to variables
        variables = extract_to_variables(data)
        
        # Display the variables
        display_variables(variables)
        
        # Make variables available in global scope for interactive use
        globals().update(variables)
        
        print(f"\n✅ Variables are now available for use!")
        print("You can access them directly: card_name, card_symbol, etc.")
        
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print("Please ensure you've pasted valid JSON data")

if __name__ == "__main__":
    main()