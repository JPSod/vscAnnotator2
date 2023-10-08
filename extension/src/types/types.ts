export interface FailedFunction {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Function/Class': string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Rule: string;
  }

export interface ComplianceScore {
    compliancePercentage: number;
    failedFunctions: FailedFunction[];
  }