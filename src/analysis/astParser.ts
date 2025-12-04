import { parse, TSESTree } from '@typescript-eslint/typescript-estree';

export function getAst(code: string): TSESTree.Program {
    try {
        return parse(code, {
            loc: true, 
            range: true,
            jsx: true, 
        });
    } catch (error) {
        console.error("Erro ao analisar o código:", error);
        throw new Error("Não foi possível gerar a AST para o arquivo. Código inválido.");
    }
}