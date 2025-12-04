// src/ui/resultsViewer.ts

import * as vscode from 'vscode';
import { FunctionComplexityResult } from '../analysis/analyser'; 
import * as path from 'path';

interface ProjectAnalysisResultItem {
    filePath: string;
    functions: FunctionComplexityResult[];
}

/**
 * Define a cor de fundo com base no valor da Complexidade Ciclomática (CC).
 */
function getComplexityColor(cc: number): string {
    if (cc >= 11) return '#f7d983'; // Amarelo/Laranja (Alto risco)
    if (cc >= 21) return '#e08a8a'; // Vermelho (Risco muito alto)
    return '#8fe08a'; // Verde (Risco baixo/moderado)
}

/**
 * Gera o conteúdo HTML para o WebView, exibindo os resultados.
 */
function getWebviewContent(results: ProjectAnalysisResultItem[]): string {
    let tableRows = '';
    
    // Totalizando para o cabeçalho
    const totalFiles = results.length;
    const allFunctions = results.flatMap(item => item.functions);
    const totalFunctions = allFunctions.length;
    const totalCCSum = allFunctions.reduce((sum, func) => sum + func.complexity, 0);
    const averageCC = totalFunctions > 0 ? (totalCCSum / totalFunctions).toFixed(2) : '0';

    // Agregação de resultados para a tabela principal
    results.forEach(fileResult => {
        fileResult.functions.forEach(func => {
            const color = getComplexityColor(func.complexity);

            tableRows += `
                <tr style="background-color: ${color};">
                    <td>${func.name}</td>
                    <td style="font-weight: bold;">${func.complexity}</td>
                    <td>${path.basename(fileResult.filePath)}:${func.line}</td>
                </tr>
            `;
        });
    });

    // Usa variáveis CSS do VS Code (var(--vscode-cor)) para um tema consistente.
    return `<!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Relatório de Complexidade Ciclomática</title>
            <style>
                body { font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
                h1, h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; }
                th { background-color: var(--vscode-list-hoverBackground); }
                .summary-box { 
                    padding: 10px; border: 1px solid var(--vscode-panel-border); 
                    margin-bottom: 20px; display: inline-block;
                    background-color: var(--vscode-editorGroup-border);
                }
            </style>
        </head>
        <body>
            <h1>📊 Complexidade Ciclomática (Projeto)</h1>
            <div class="summary-box">
                <strong>Arquivos Analisados:</strong> ${totalFiles} |
                <strong>Total de Funções:</strong> ${totalFunctions} |
                <strong>CC Média do Projeto:</strong> ${averageCC}
            </div>
            <h2>Detalhes por Função</h2>
            <table>
                <thead>
                    <tr>
                        <th>Função</th>
                        <th>CC</th>
                        <th>Arquivo:Linha</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>`;
}

/**
 * Cria e exibe um painel WebView.
 */
export function showAnalysisResults(results: ProjectAnalysisResultItem[], context: vscode.ExtensionContext) {
    
    const panel = vscode.window.createWebviewPanel(
        'complexityReport', 
        'Complexidade Ciclomática', 
        vscode.ViewColumn.One, // Abre na primeira coluna (principal)
        {
            enableScripts: false,
            // Permite que o WebView mantenha o estado mesmo quando não está visível
            retainContextWhenHidden: true 
        }
    );

    // Define o conteúdo HTML
    panel.webview.html = getWebviewContent(results);
}