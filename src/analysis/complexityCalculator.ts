import { TSESTree } from '@typescript-eslint/typescript-estree';

const DIRECT_DECISION_NODES = [
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'DoWhileStatement',
    'ConditionalExpression', // Operador ternário
    'CatchClause',
];

function countDecisionPoints(node: TSESTree.Node): number {
    let decisionCount = 0;

    if (DIRECT_DECISION_NODES.includes(node.type)) {
        decisionCount++;
    }

    if (node.type === 'SwitchCase') {
        decisionCount++;
    }

    if (node.type === 'LogicalExpression' && 
        (node.operator === '&&' || node.operator === '||')
    ) {
        decisionCount++;
    }
    
    for (const key in node) {
        const child = (node as any)[key]; 

        if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && item.type) { 
                        decisionCount += countDecisionPoints(item);
                    }
                }
            } 
            else if (child.type) {
                decisionCount += countDecisionPoints(child);
            }
        }
    }

    return decisionCount;
}

/**
 * Calcula a Complexidade Ciclomática (CC) para um nó de função.
 * CC = 1 (caminho base) + Número de Pontos de Decisão.
 * * @param functionNode O nó da AST que representa a função (ex: FunctionDeclaration).
 * @returns A complexidade ciclomática da função.
 */
export function calculateFunctionComplexity(functionNode: TSESTree.Node): number {
    // A Complexidade Ciclomática é sempre 1 (o caminho de entrada/saída) + o número de decisões.
    const decisions = countDecisionPoints(functionNode);
    return 1 + decisions;
}