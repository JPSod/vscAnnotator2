import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import re
import os

# Get the absolute path of the directory containing the Python script
script_directory = os.path.dirname(os.path.abspath(__file__))

# Navigate to the parent directory (main_directory) to access the model
model_directory = os.path.join(script_directory, "..", "..", "VSSCRIBE")

def preprocess(text):
    # Convert to lowercase for consistent processing
    return text.lower()

def get_rules_from_text(text):
    # Define the regular expression pattern to match the desired section headings
    section_pattern = r'\d+\.\d+\.\d+\.\d+ ([\s\S]+?)(?=\d+\.\d+\.\d+\.\d+|\Z)'
  
    # Match section headings and extract content
    extracted_sections = re.findall(section_pattern, text)
  
    # Return the extracted sections
    return extracted_sections

async def analyze_compliance(python_code, rulestext):
    print('this function was called')
    # Load the locally saved tokenizer and model
    tokenizer = AutoTokenizer.from_pretrained(model_directory)
    model = AutoModelForSequenceClassification.from_pretrained(model_directory)

    # Call the get_rules_from_text function
    rules = await get_rules_from_text(rulestext)
    compliance_threshold = 0.5

    total_segments = 0
    compliant_segments = 0
    failed_functions_details = ''
    failed_functions_details = ''

    # Iterate through preprocessed rules and run the model for each rule
    for rule in rules:
        preprocessed_rule = preprocess(rule)

        # Split Python code into segments based on functions or classes
        python_code_segments = python_code.split('def ') + python_code.split('class ')

        # Iterate through Python code segments and run the model for each segment and rule
        for segment in python_code_segments:
            preprocessed_code = preprocess(segment)
            concatenated_input = f"{preprocessed_rule} [SEP] {preprocessed_code}"
            print(concatenated_input)
            input_tokens = tokenizer.encode(concatenated_input, padding='max_length', truncation=True, max_length=512)

            # Find the index of the [SEP] token
            sep_token_index = input_tokens.index(tokenizer.sep_token_id)

            # Calculate total tokens including special tokens
            total_tokens = len(input_tokens)

            # Check if total tokens exceed the model's maximum limit
            max_token_limit = 512
            if total_tokens > max_token_limit:
                # Calculate how much to truncate from either side of [SEP]
                tokens_to_truncate = total_tokens - max_token_limit
                tokens_to_truncate_from_each_side = tokens_to_truncate // 2

                # Calculate the start and end indices for truncation
                start_truncate_index = sep_token_index - tokens_to_truncate_from_each_side
                end_truncate_index = sep_token_index + tokens_to_truncate_from_each_side

                # Truncate tokens
                input_tokens = input_tokens[:start_truncate_index] + input_tokens[end_truncate_index+1:]

            # Perform padding if needed (padding will only be added if tokens were removed)
            if len(input_tokens) < max_token_limit:
                padding_tokens = max_token_limit - len(input_tokens)
                input_tokens.extend([tokenizer.pad_token_id] * padding_tokens)

            # Convert input tokens to a PyTorch tensor
            input_tensor = torch.tensor(input_tokens).unsqueeze(0)

            # Run the model for the current segment and the current rule
            with torch.no_grad():
                model_output = model(input_tensor)
            probability_score = 1 / (1 + torch.exp(-model_output[0]))

            # Process the model output as needed
            print(f"Rule: {rule} - Segment: {segment}")
            print("Model Output:", model_output)

            # Check if the segment is compliant or not based on probability score
            is_compliant = probability_score >= compliance_threshold

            total_segments += 1
            if is_compliant:
                compliant_segments += 1
            else:
                failed_functions_details += f"Function/Class: {segment}\nRule: {rule}\n\n"

    # Calculate the compliance percentage
    compliance_percentage = compliant_segments / total_segments

    return {"compliancePercentage": compliance_percentage, "failedFunctions": failed_functions_details}
