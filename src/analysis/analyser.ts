import { TSESTree } from '@typescript-eslint/typescript-estree';
import { getAst } from './astParser';
import { calculateFunctionComplexity } from './complexityCalculator';

export interface FunctionComplexityResult {
    name: string;
    line: number;
    complexity: number;
}

export interface FileComplexityResult {
    totalFunctions: number;
    totalComplexity: number; 
    averageComplexity: number; 
    functions: FunctionComplexityResult[]; 
}

const FUNCTION_NODES = [
    'FunctionDeclaration', 
    'FunctionExpression', 
    'ArrowFunctionExpression',
    'MethodDefinition', 
];


function getFunctionName(node: TSESTree.Node, parent?: TSESTree.Node): string {
    if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
    } 
    if (node.type === 'MethodDefinition' && node.key.type === 'Identifier') {
        return node.key.name;
    }
    if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return parent.id.name;
    }
    
    return 'Função Anônima'; 
}


/**
 * Percorre a AST, encontra os nós de função e chama o calculador para cada um.
 * ESTA FUNÇÃO NÃO DEVE PERCORRER O CORPO DAS FUNÇÕES ENCONTRADAS.
 */
function traverseAndAnalyze(node: TSESTree.Node, results: FunctionComplexityResult[], parent?: TSESTree.Node) {
    
    let isFunctionNode = FUNCTION_NODES.includes(node.type);
    
    if (isFunctionNode) {
        const complexity = calculateFunctionComplexity(node);
        
        const name = getFunctionName(node, parent);
        
        if (node.loc) {
            results.push({
                name: name,
                line: node.loc.start.line,
                complexity: complexity,
            });
        }
    }
    
    for (const key in node) {
        const child = (node as any)[key]; 

        if (child && typeof child === 'object') {
            
            if (child.type) {
                 traverseAndAnalyze(child as TSESTree.Node, results, node);
            }
            
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && item.type) {
                        traverseAndAnalyze(item as TSESTree.Node, results, node);
                    }
                }
            }
        }
    }
}


export function analyzeFile(code: string, filePath: string): FileComplexityResult {
    try {
        const ast = getAst(code);
        const functionResults: FunctionComplexityResult[] = [];
        
        traverseAndAnalyze(ast, functionResults);

        const totalFunctions = functionResults.length;
        const totalComplexity = functionResults.reduce((sum, func) => sum + func.complexity, 0);
        
        // Calcula a Complexidade Média (evita divisão por zero)
        const averageComplexity = totalFunctions > 0 
            ? totalComplexity / totalFunctions
            : 0;

        return {
            totalFunctions: totalFunctions,
            totalComplexity: totalComplexity,
            averageComplexity: parseFloat(averageComplexity.toFixed(2)), // Arredonda para 2 casas decimais
            functions: functionResults
        };

    } catch (error) {
        console.error(`Erro ao analisar o arquivo ${filePath}:`, error);
        return {
            totalFunctions: 0,
            totalComplexity: 0,
            averageComplexity: 0,
            functions: []
        };
    }
}

function findFunctionNode(
    node: TSESTree.Node,
    targetName: string,
    targetLine: number,
    parent?: TSESTree.Node
): TSESTree.Node | null {
    const isFunctionNode = FUNCTION_NODES.includes(node.type);
    
    if (isFunctionNode) {
        const name = getFunctionName(node, parent);
        if (node.loc && name === targetName && node.loc.start.line === targetLine) {
            return node;
        }
    }
    
    for (const key in node) {
        const child = (node as any)[key];
        
        if (child && typeof child === 'object') {
            if (child.type) {
                const found = findFunctionNode(child as TSESTree.Node, targetName, targetLine, node);
                if (found) return found;
            }
            
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && item.type) {
                        const found = findFunctionNode(item as TSESTree.Node, targetName, targetLine, node);
                        if (found) return found;
                    }
                }
            }
        }
    }
    
    return null;
}

export function findFunctionInCode(code: string, functionName: string, line: number): TSESTree.Node | null {
    try {
        const ast = getAst(code);
        return findFunctionNode(ast, functionName, line);
    } catch (error) {
        console.error('Erro ao encontrar função:', error);
        return null;
    }
}