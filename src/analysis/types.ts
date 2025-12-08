export interface FunctionComplexityResult {
    name: string;
    line: number;
    complexity: number;
}

export interface FileAnalysisResult {
    filePath: string;
    functions: FunctionComplexityResult[];
    totalComplexity: number;
    averageComplexity: number;
}