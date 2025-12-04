//percorrer a AST e contar os pontos de decisao

import { TSESTree } from '@typescript-eslint/typescript-estree';
/**
 * Tipos de nós que sempre adicionam +1 à complexidade de forma direta.
 * (Excluímos 'LogicalExpression' e 'SwitchCase' para lidar com eles separadamente)
 */
const DIRECT_DECISION_NODES = [
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'DoWhileStatement',
    'ConditionalExpression', // Operador ternário
    'CatchClause',
];

/**
 * Percorre recursivamente um nó da AST e conta o número total de pontos de decisão (branches).
 *
 * @param node O nó da AST a ser analisado.
 * @returns O total de pontos de decisão encontrados no nó e seus filhos.
 */
function countDecisionPoints(node: TSESTree.Node): number {
    let decisionCount = 0;

    // 1. Contagem direta de nós de decisão (if, for, while, catch, etc.)
    if (DIRECT_DECISION_NODES.includes(node.type)) {
        decisionCount++;
    }

    // 2. Lógica específica para SwitchCase
    if (node.type === 'SwitchCase') {
        // Cada 'case' (incluindo 'default') conta como um ponto de decisão.
        decisionCount++;
    }

    // 3. Lógica específica para Operadores Lógicos (&& e ||)
    if (node.type === 'LogicalExpression' && 
        (node.operator === '&&' || node.operator === '||')
    ) {
        // Cada operador lógico (&& ou ||) representa um novo caminho de controle.
        decisionCount++;
    }
    
    // 4. Percorrer recursivamente os nós filhos para continuar a contagem
    for (const key in node) {
        const child = (node as any)[key]; 

        if (child && typeof child === 'object') {
            // Se for um array de nós filhos (ex: lista de statements em um bloco)
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && item.type) { 
                        decisionCount += countDecisionPoints(item);
                    }
                }
            } 
            // Se for um único nó filho
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