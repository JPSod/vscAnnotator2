import csv
import openai
import time
import random

# Set your OpenAI API key
api_key = "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"

# Function to check if a code snippet follows a rule
def check_rule(code_snippet, rule):
    # Compose a prompt to ask ChatGPT
    prompt = f"Only reply true or false. \nDoes the following code snippet follow this rule: {rule}? \nCode Snippet: {code_snippet}"
    
    try:
        # Send a request to ChatGPT
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",  # Adjust the model as needed
            messages=[
                {"role": "system", "content": "You are a software engineer who's job is to analyze code."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=10,  
            api_key=api_key,
            temperature=0.0  # Set temperature to 0 to get deterministic results
        )

        # Access the response text
        response_text = response.choices[0].message.content

        # Check if it contains "True" or "False"
        if "true" in response_text.lower():
            result = True
        elif "false" in response_text.lower():
            result = False
        else:
            # Handle other cases or errors
            result = 'NA'

        return result
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

if __name__ == "__main__":
    # Load the CSV file with code snippets
    start_row_number = 328  # Start reading from row number 328 (where we left off)
    rows = []
    
    with open("randomized_code_snippets.csv", "r", encoding="utf-8") as file:
        reader = csv.reader(file)
        header = next(reader)  # Skip the header row
    
        # Iterate through rows, starting from row 328
        for current_row_number, row in enumerate(reader, start=1):
            if current_row_number >= start_row_number:
                rows.append(row)

    # Load the CSV file with rules
    rules_BS30440 = []
    rules_other = []
    rules_nonsense = []
    with open("standard_rules.csv", "r", encoding="utf-8") as rule_file:
        reader = csv.reader(rule_file)
        next(reader)  # Skip the header row
        for row in reader:
            rule = row[0]  # The rules are located in the first column
            rule_type = row[2].lower() # The rules category is on the second
            if rule_type == 'bs30440':
                rules_BS30440.append(rule)
            elif rule_type == 'other':
                rules_other.append(rule)
            else:
                rules_nonsense.append(rule)

    # Initialize a list to store the results
    results = []

    # Iterate through each row in the CSV
    for row in rows:
        code_snippet = row[2]

        # Randomly select a rule from BS30440 rules and another rule from Other
        selected_rules = []
        selected_rules.append(random.choice(rules_BS30440))
        selected_rules.append(random.choice(rules_other))

        # Randomly select a nonsense rule with a 20% chance
        if random.random() < 0.10:
            selected_rules.append(random.choice(rules_nonsense))

        # Check if the code snippet follows the randomly selected rule
        for rule in selected_rules:
            result = check_rule(code_snippet, rule)
            
            if result is None:
                # Handle the case where there is no response
                break  # Exit the inner loop if there's an error
            
            time.sleep(3)

            # Store the result in a dictionary
            result_dict = {
                "Code Snippet": code_snippet,
                "Rule": rule,
                "Result": result
            }
            results.append(result_dict)

        # Check if there was an error in the inner loop
        if result is None:
            break  # Exit the outer loop if there's an error

    # Save the results to a CSV file
    with open("results2.csv", mode="w", newline="") as file:
        writer = csv.writer(file)
        # Write the header row
        writer.writerow(["Code Snippet", "Rule", "Result"])
        for result_dict in results:
            # Write each result
            writer.writerow([result_dict["Code Snippet"], result_dict["Rule"], result_dict["Result"]])