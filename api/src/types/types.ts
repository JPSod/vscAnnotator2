export interface FailedFunction {
    'Function/Class': string;
    Rule: string;
  }

export interface ComplianceScore {
    compliancePercentage: number;
    failedFunctions: FailedFunction[];
  }