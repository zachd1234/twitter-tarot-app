#!/bin/bash

# Extract fields from API JSON output using jq
# Usage: ./extract_with_jq.sh < api_output.json
# Or: echo "$json_output" | ./extract_with_jq.sh

echo "Reading JSON from stdin..."
json_input=$(cat)

echo "=============================================="
echo "EXTRACTING FIELDS AS VARIABLES"
echo "=============================================="

# Extract each field as a variable
card_name=$(echo "$json_input" | jq -r '.card.card_name // "null"')
card_symbol=$(echo "$json_input" | jq -r '.card.symbol // "null"')
card_interpretation=$(echo "$json_input" | jq -r '.card.interpretation // "null"')
personality_signal=$(echo "$json_input" | jq -r '.personality_signal // "null"')
image_url=$(echo "$json_input" | jq -r '."Image generation".output.image_url // "null"')
image_type=$(echo "$json_input" | jq -r '."Image generation".output.type // "null"')

# Display the variables
echo ""
echo "card_name=\"$card_name\""
echo ""
echo "card_symbol=\"$card_symbol\""
echo ""
echo "card_interpretation=\"$card_interpretation\""
echo ""
echo "personality_signal=\"$personality_signal\""
echo ""
echo "image_url=\"$image_url\""
echo ""
echo "image_type=\"$image_type\""

echo ""
echo "=============================================="
echo "INDIVIDUAL FIELD ACCESS:"
echo "=============================================="
echo "Card Name:"
echo "$card_name"
echo ""
echo "Card Symbol:"
echo "$card_symbol"
echo ""
echo "Card Interpretation:"
echo "$card_interpretation"
echo ""
echo "Image URL:"
echo "$image_url"
echo ""
echo "==============================================" 