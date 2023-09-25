import pandas as pd
import random

# Read the CSV file into a DataFrame
df = pd.read_csv('code_snippets.csv')

# Shuffle the rows
df = df.sample(frac=1, random_state=42)

# Save the randomized DataFrame to a new CSV file
df.to_csv('randomized_code_snippets.csv', index=False)