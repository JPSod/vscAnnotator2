// @ts-ignore
import { AutoTokenizer, BertForSequenceClassification } from 'transformers';
import { getRulesFromText } from './getRulesFromText';

// Load the tokenizer and model
const tokenizer = AutoTokenizer.from_pretrained("microsoft/codebert-base")

// Binary classification model, pass rule or not. 1 = pass, 0 = fail.
const model = BertForSequenceClassification.fromPretrained('microsoft/codebert-base', { num_labels: 1 });

function preprocess(text: string): string {
  // Convert to lowercase for consistent processing
  return text.toLowerCase();
}

async function analyzeCompliance(pythonCode: string, rulestext: string) {
  // Call another function to get the rules from text
  const rules = await getRulesFromText(rulestext);
  const complianceThreshold = 0.5;

  let totalSegments = 0;
  let compliantSegments = 0;
  let failedFunctionsDetails = '';

  // Iterate through preprocessed rules and run the model for each rule
  for (const rule of rules) {
    const preprocessedRule = preprocess(rule);

    // Split Python code into segments based on functions or classes
    const pythonCodeSegments = pythonCode.split(/def\s+|class\s+/);

    // Iterate through Python code segments and run the model for each segment and rule
    for (const segment of pythonCodeSegments) {
      const preprocessedCode = preprocess(segment);
      const concatenatedInput = `${preprocessedRule} [SEP] ${preprocessedCode}`;
      const inputTokens = tokenizer.encode(concatenatedInput, { addSpecialTokens: true });

       // Find the index of the [SEP] token
      const sepTokenIndex = inputTokens.indexOf(tokenizer.sepTokenId);

      // Calculate total tokens including special tokens
      const totalTokens = inputTokens.length;

      // Check if total tokens exceed the model's maximum limit
      const maxTokenLimit = 512;
      if (totalTokens > maxTokenLimit) {
        // Calculate how much to truncate from either side of [SEP]
        const tokensToTruncate = totalTokens - maxTokenLimit;
        const tokensToTruncateFromEachSide = Math.floor(tokensToTruncate / 2);
      
        // Calculate the start and end indices for truncation
        const startTruncateIndex = sepTokenIndex - tokensToTruncateFromEachSide;
        const endTruncateIndex = sepTokenIndex + tokensToTruncateFromEachSide;
      
        // Truncate tokens
        inputTokens.splice(startTruncateIndex, endTruncateIndex - startTruncateIndex + 1);
      }
    
      // Perform padding if needed (padding will only be added if tokens were removed)
      if (inputTokens.length < maxTokenLimit) {
        const paddingTokens = maxTokenLimit - inputTokens.length;
        inputTokens.push(...Array(paddingTokens).fill(tokenizer.padTokenId));
      }

      // Run the model for the current segment and the current rule
      const modelOutput = await model.predict([inputTokens]);
      const probabilityScore = 1 / (1 + Math.exp(-modelOutput[0]));

      // Process the model output as needed
      console.log(`Rule: ${rule} - Segment: ${segment}`);
      console.log("Model Output:", modelOutput);

      // Check if the segment is compliant or not based on probability score
      const isCompliant = probabilityScore >= complianceThreshold; // Define your threshold here

      totalSegments++;
      if (isCompliant) {
        compliantSegments++;
      } else {
        failedFunctionsDetails += `Function/Class: ${segment}\nRule: ${rule}\n\n`;
      }
    }
  }

  // Calculate the compliance percentage
  const compliancePercentage = (compliantSegments / totalSegments);

  return { compliancePercentage, failedFunctions: failedFunctionsDetails };
}
export { analyzeCompliance };