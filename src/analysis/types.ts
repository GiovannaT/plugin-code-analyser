// src/analysis/types.ts (Você pode criar um novo arquivo para tipos ou usar o analyzer.ts)

/** Representa a Complexidade Ciclomática de uma única função */
export interface FunctionComplexityResult {
    name: string;
    line: number;
    complexity: number;
}

/** Representa o resultado de um único arquivo analisado */
export interface FileAnalysisResult {
    filePath: string;
    functions: FunctionComplexityResult[];
    totalComplexity: number;
    averageComplexity: number;
}