// src/analysis/analyzer.ts - CÓDIGO CORRIGIDO

import { TSESTree } from '@typescript-eslint/typescript-estree';
import { getAst } from './astParser';
import { calculateFunctionComplexity } from './complexityCalculator';

// Definição de tipos simplificada (Manter aqui ou em types.ts)
export interface FunctionComplexityResult {
    name: string;
    line: number;
    complexity: number;
}

export interface FileComplexityResult {
    totalFunctions: number;
    totalComplexity: number; // Soma de todas as CCs
    averageComplexity: number; // Média de CC por função
    functions: FunctionComplexityResult[]; // Mantemos a lista detalhada para referência
}

// Tipos de nó que definem o início de uma nova função
const FUNCTION_NODES = [
    'FunctionDeclaration', 
    'FunctionExpression', 
    'ArrowFunctionExpression',
    'MethodDefinition', 
];

// --- Funções Auxiliares de Nomenclatura (Pode ser transferida para um utilitário) ---

/**
 * Tenta determinar o nome de uma função/método.
 */
function getFunctionName(node: TSESTree.Node, parent?: TSESTree.Node): string {
    // 1. FunctionDeclaration (ex: function nome() {})
    if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
    } 
    // 2. MethodDefinition (ex: class { metodo() {} })
    if (node.type === 'MethodDefinition' && node.key.type === 'Identifier') {
        return node.key.name;
    }
    // 3. ArrowFunction ou FunctionExpression (ex: const nome = () => {})
    if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return parent.id.name;
    }
    
    return 'Função Anônima'; 
}


// --- Travessia Corrigida ---

/**
 * Percorre a AST, encontra os nós de função e chama o calculador para cada um.
 * ESTA FUNÇÃO NÃO DEVE PERCORRER O CORPO DAS FUNÇÕES ENCONTRADAS.
 */
function traverseAndAnalyze(node: TSESTree.Node, results: FunctionComplexityResult[], parent?: TSESTree.Node) {
    
    let isFunctionNode = FUNCTION_NODES.includes(node.type);
    
    // Casos especiais para funções anônimas (Arrow/FunctionExpression) que são filhos de um nó pai.
    if (isFunctionNode) {
        // 1. Calcular a CC. Passamos o próprio nó da função, o calculador percorrerá o seu corpo.
        const complexity = calculateFunctionComplexity(node);
        
        // 2. Determinar nome e linha
        const name = getFunctionName(node, parent);
        
        if (node.loc) {
            results.push({
                name: name,
                line: node.loc.start.line,
                complexity: complexity,
            });
        }
    }
    
    // 3. Continuar a travessia recursiva
    // A travessia deve continuar para encontrar outras funções aninhadas,
    // mas deve ser cuidadosa para não duplicar a contagem.

    for (const key in node) {
        const child = (node as any)[key]; 

        if (child && typeof child === 'object') {
            
            // Verifica se o filho é um nó da AST (possui a propriedade 'type')
            if (child.type) {
                 // Chamada recursiva, passando o nó atual como pai
                 traverseAndAnalyze(child as TSESTree.Node, results, node);
            }
            
            // Se for um array de nós filhos, percorre cada item
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


// --- Função de Exportação Principal ---
export function analyzeFile(code: string, filePath: string): FileComplexityResult {
    try {
        const ast = getAst(code);
        const functionResults: FunctionComplexityResult[] = [];
        
        // 1. Encontra e calcula a CC de todas as funções
        traverseAndAnalyze(ast, functionResults);

        // 2. Agrega os resultados no nível do arquivo
        const totalFunctions = functionResults.length;
        const totalComplexity = functionResults.reduce((sum, func) => sum + func.complexity, 0);
        
        // 3. Calcula a Complexidade Média (evita divisão por zero)
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
        // Lidar com erros de parsing
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