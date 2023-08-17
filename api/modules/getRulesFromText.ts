async function getRulesFromText(text: string): Promise<string[]> {
    // Define the regular expression pattern to match the desired section headings
    const sectionPattern = /\d+\.\d+\.\d+\.\d+ ([\s\S]+?)(?=\d+\.\d+\.\d+\.\d+|\Z)/g;
  
    // Match section headings and extract content
    const extractedSections: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = sectionPattern.exec(text)) !== null) {
      extractedSections.push(match[1].trim());
    }
  
    // Return the extracted sections
    return extractedSections;
  }
  
  export { getRulesFromText };