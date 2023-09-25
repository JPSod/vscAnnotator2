import pandas as pd
import os
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, AdamW
from sklearn.metrics import confusion_matrix
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
import seaborn as sns
from torch.nn.functional import binary_cross_entropy_with_logits
import matplotlib.pyplot as plt

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Construct the relative path to the CSV file
csv_file = os.path.join(script_dir, 'results.csv')

# Load the CSV dataset
dataset = pd.read_csv(csv_file, encoding='cp1252')

# Extract the text data and labels
text_column1 = dataset['Code Snippet'].tolist()  # Code Snippets
text_column2 = dataset['Rule'].tolist()  # Rules
dataset['Result'] = dataset['Result'].map({'TRUE': 1, 'FALSE': 0})
labels = dataset['Result'].tolist()  # Replace 'label_column' with the actual column name

# Concatenate text columns with [SEP] token in between
input_text = [f"{text1} [SEP] {text2}" for text1, text2 in zip(text_column1, text_column2)]

# Split the data into training and validation sets
train_text, val_text, train_labels, val_labels = train_test_split(
    input_text, labels, test_size=0.3, random_state=42 
)

# Load Pretrained CodeBERT Model
model_name = "microsoft/codebert-base"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

# Tokenize the dataset
def tokenize_text(text):
    return tokenizer(text, padding='max_length', truncation=True, return_tensors='pt')

# Tokenize training and validation data
train_encodings = [tokenize_text(text) for text in train_text]
val_encodings = [tokenize_text(text) for text in val_text]

# Extract input_ids and attention_mask and remove the middle dimension of size 1
train_input_ids = torch.stack([encoding['input_ids'].squeeze() for encoding in train_encodings])
train_attention_masks = torch.stack([encoding['attention_mask'].squeeze() for encoding in train_encodings])
val_input_ids = torch.stack([encoding['input_ids'].squeeze() for encoding in val_encodings])
val_attention_masks = torch.stack([encoding['attention_mask'].squeeze() for encoding in val_encodings])

# Print the shapes to verify
print(train_input_ids.shape)
print(train_attention_masks.shape)
print(torch.tensor(train_labels).shape)

# Create Data Loaders
# Create Data Loaders
batch_size = 32

# Encode labels as one-hot
def encode_labels(labels, num_classes):
    one_hot_labels = []
    for label in labels:
        one_hot = [0] * num_classes
        one_hot[int(label)] = 1
        one_hot_labels.append(one_hot)
    return torch.tensor(one_hot_labels)

num_classes = 2  # Number of classes for binary classification
train_one_hot_labels = encode_labels(train_labels, num_classes)
train_dataset = TensorDataset(train_input_ids, train_attention_masks, train_one_hot_labels)
train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

# Fine-Tuning
optimizer = AdamW(model.parameters(), lr=2e-5)
num_epochs = 3

for epoch in range(num_epochs):
    model.train()
    for batch in train_loader:
        input_ids, attention_mask, one_hot_labels = batch
        outputs = model(input_ids, attention_mask=attention_mask)
        logits = outputs.logits
        loss = binary_cross_entropy_with_logits(logits, one_hot_labels)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

# Evaluation
model.eval()

# Run inference and compute predictions
with torch.no_grad():
    val_outputs = model(val_input_ids, attention_mask=val_attention_masks)
    val_logits = val_outputs.logits
    val_predictions = torch.argmax(val_logits, dim=1).tolist()

# Compute accuracy and F1-score using scikit-learn
val_accuracy = accuracy_score(val_labels, val_predictions)
val_f1_score = f1_score(val_labels, val_predictions)

print(f"Validation Accuracy: {val_accuracy}")
print(f"Validation F1-Score: {val_f1_score}")

# Save the trained model
model.save_pretrained('VSSCRIBE')
tokenizer.save_pretrained('VSSCRIBE')
cwd = os.getcwd()
print("Current working directory:", cwd)


# Run inference and compute predictions on the test split
test_encodings = [tokenize_text(text) for text in val_text]
test_input_ids = torch.stack([encoding['input_ids'].squeeze() for encoding in test_encodings])
test_attention_masks = torch.stack([encoding['attention_mask'].squeeze() for encoding in test_encodings])

with torch.no_grad():
    test_outputs = model(test_input_ids, attention_mask=test_attention_masks)
    test_logits = test_outputs.logits
    test_predictions = torch.argmax(test_logits, dim=1).tolist()

# Compute accuracy and F1-score on the test set
test_accuracy = accuracy_score(val_labels, test_predictions)
test_f1_score = f1_score(val_labels, test_predictions)

# Compute the confusion matrix
from sklearn.metrics import confusion_matrix
conf_matrix = confusion_matrix(val_labels, test_predictions)

# Calculate the percentage of false positives and false negatives
total_samples = len(val_labels)
false_positives = conf_matrix[0][1]  # Predicted negative, but actual positive
false_negatives = conf_matrix[1][0]  # Predicted positive, but actual negative

false_positives_percentage = (false_positives / total_samples) * 100
false_negatives_percentage = (false_negatives / total_samples) * 100

# Plot the confusion matrix
plt.figure(figsize=(8, 6))
sns.heatmap(conf_matrix, annot=True, fmt='d', cmap='Blues', cbar=False, 
            xticklabels=['Negative', 'Positive'], yticklabels=['Negative', 'Positive'])
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.title('Confusion Matrix')
plt.show()
