import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import re
import os
import sys
import subprocess
import json
import ast

# Get the absolute path of the directory containing the Python script
script_directory = os.path.dirname(os.path.abspath(__file__))

# Navigate to the parent directory of the project
desired_directory = os.path.dirname(os.path.dirname(script_directory))

# Navigate to the parent directory (main_directory) to access the model
model_directory = os.path.join(desired_directory, "BERT", "VSSCRIBE")

def extract_functions_and_classes(code):
    functions_and_classes = []

    # Parse the Python code into an AST
    tree = ast.parse(code)

    # Iterate through the AST nodes
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # If it's a function definition, add it to the list
            functions_and_classes.append(ast.unparse(node))
        elif isinstance(node, ast.ClassDef):
            # If it's a class definition, add it to the list
            functions_and_classes.append(ast.unparse(node))

    return functions_and_classes

def preprocess(text):
    # Convert to lowercase for consistent processing
    return text.lower()

def get_rules_from_text(text):
    lines = text.split('\n')  # Split the text into lines
    matches = []
    
    for line in lines:
        # Use a regular expression to check if the line starts with a digit followed by a period
        if re.match(r'^\d+\.', line):
            # Remove the first word (section number) and add the content to the matches list
            parts = line.split(' ', 1)
            if len(parts) > 1:
                matches.append(parts[1])
    
    return matches

async def analyze_compliance(python_code, rulestext):
    print('This function was called')
    # Load the locally saved tokenizer and model
    tokenizer = AutoTokenizer.from_pretrained(model_directory)
    model = AutoModelForSequenceClassification.from_pretrained(model_directory)
    
    # Call the get_rules_from_text function
    rules = get_rules_from_text(rulestext)
            
    compliance_threshold = 0.5

    total_segments = 0
    compliant_segments = 0
    failed_functions = []

    # Iterate through preprocessed rules and run the model for each rule
    for rule in rules:
        preprocessed_rule = preprocess(rule)

        # Split Python code into segments based on functions or classes
        python_code_segments = extract_functions_and_classes(python_code)

        # Iterate through Python code segments and run the model for each segment and rule
        for segment in python_code_segments:
            preprocessed_code = preprocess(segment)
            concatenated_input = f"{preprocessed_rule} [SEP] {preprocessed_code}"
            input_tokens = tokenizer.encode(concatenated_input, padding='max_length', truncation=True, max_length=512)
            
            # Check if total tokens exceed the model's maximum limit
            max_token_limit = 512
            if len(input_tokens) > max_token_limit:
                # Calculate how much to truncate from either side of [SEP]
                tokens_to_truncate = len(input_tokens) - max_token_limit
                tokens_to_truncate_from_each_side = tokens_to_truncate // 2

                # Calculate the start and end indices for truncation
                sep_token_index = input_tokens.index(tokenizer.sep_token_id)
                start_truncate_index = sep_token_index - tokens_to_truncate_from_each_side
                end_truncate_index = sep_token_index + tokens_to_truncate_from_each_side

                # Truncate tokens
                input_tokens = input_tokens[:start_truncate_index] + input_tokens[end_truncate_index+1:]

            # Perform padding if needed (padding will only be added if tokens were removed)
            if len(input_tokens) < max_token_limit:
                padding_tokens = max_token_limit - len(input_tokens)
                input_tokens.extend([tokenizer.pad_token_id] * padding_tokens)

            # Create the attention mask
            attention_mask = [1] * len(input_tokens)

            # Convert input tokens and attention mask to PyTorch tensors
            input_tensor = torch.tensor(input_tokens).unsqueeze(0)
            attention_mask = torch.tensor(attention_mask).unsqueeze(0)

            # Run the model for the current segment and the current rule
            with torch.no_grad():
                model_output = model(input_tensor, attention_mask=attention_mask)
            
            positive_class_logits = model_output.logits[:, 1]
            probability_scores = torch.sigmoid(positive_class_logits)
            predictions = (probability_scores >= compliance_threshold).float()

            # Process the model output as needed
            print(f"Rule: {rule} - Segment: {segment}")
            print("Model Output:", model_output)

            total_segments += 1
            if predictions == 1:
                compliant_segments += 1
            else:
                failed_functions.append({
                "Function/Class": segment,
                "Rule": rule
            })

    # Calculate the compliance percentage
    compliance_percentage = compliant_segments / total_segments

    return {"compliancePercentage": compliance_percentage, "failedFunctions": failed_functions}

try:
    # Get command-line arguments
    python_code_arg_index = sys.argv.index('--pythonCode') + 1
    rulestext_arg_index = sys.argv.index('--rulestext') + 1

    python_code = sys.argv[python_code_arg_index]
    rulestext = sys.argv[rulestext_arg_index]
    
    # Now call analyze_compliance function with these variables
    import asyncio
    result = asyncio.run(analyze_compliance(python_code, rulestext))

    # Serialize the result to JSON
    output_json = json.dumps(result)
    print('output_json = ' + output_json)

except subprocess.CalledProcessError as e:
    sys.exit(e.returncode)