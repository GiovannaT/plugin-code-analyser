import * as vscode from "vscode";
import {
  FunctionComplexityResult,
  findFunctionInCode,
} from "../analysis/analyser";
import {
  generatePathCoverageGraph,
  PathCoverageGraph,
} from "../analysis/pathCoverageGraph";
import * as path from "path";
import * as fs from "fs";

interface ProjectAnalysisResultItem {
  filePath: string;
  functions: FunctionComplexityResult[];
}

const getComplexityColor = (cc: number): string => {
  if (cc >= 11) return "#edae01ff"; // (Alto risco)
  if (cc >= 21) return "#ff0000ff"; // (Risco muito alto)
  return "#0cec00ff"; // (Risco baixo/moderado)
};

function getWebviewContent(results: ProjectAnalysisResultItem[]): string {
  let tableRows = "";

  const totalFiles = results.length;
  const allFunctions = results.flatMap((item) => item.functions);
  const totalFunctions = allFunctions.length;
  const totalCCSum = allFunctions.reduce(
    (sum, func) => sum + func.complexity,
    0
  );
  const averageCC =
    totalFunctions > 0 ? (totalCCSum / totalFunctions).toFixed(2) : "0";

  results.forEach((fileResult, fileIndex) => {
    fileResult.functions.forEach((func, funcIndex) => {
      const color = getComplexityColor(func.complexity);
      const rowId = `row_${fileIndex}_${funcIndex}`;
      const dataFile = encodeURIComponent(fileResult.filePath);
      const dataName = encodeURIComponent(func.name);
      const dataLine = func.line;

      tableRows += `
                <tr id="${rowId}" 
                    style="background-color: ${color}; cursor: pointer;" 
                    data-file="${dataFile}"
                    data-name="${dataName}"
                    data-line="${dataLine}"
                    onclick="handleRowClick('${dataFile}', '${dataName}', ${dataLine})">
                    <td>${func.name}</td>
                    <td style="font-weight: bold;">${func.complexity}</td>
                    <td>${path.basename(fileResult.filePath)}:${func.line}</td>
                </tr>
            `;
    });
  });

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
                tbody { color: black;}
                tr:hover { opacity: 0.8; }
                .summary-box { 
                    padding: 10px; border: 1px solid var(--vscode-panel-border); 
                    margin-bottom: 20px; display: inline-block;
                    background-color: var(--vscode-editorGroup-border);
                }
            </style>
        </head>
        <body>
            <h1>📊 Cyclomatic Complexity/Path Coverage</h1>
            <div class="summary-box">
                <strong>Arquivos Analisados:</strong> ${totalFiles} |
                <strong>Total de Funções:</strong> ${totalFunctions} |
                <strong>CC Média do Projeto:</strong> ${averageCC}
            </div>
            <h2>Detalhes por Função</h2>
            <p style="font-size: 12px; color: var(--vscode-descriptionForeground);">Clique em uma linha para ver o grafo de path coverage</p>
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
            <script>
                const vscode = acquireVsCodeApi();
                
                function handleRowClick(filePath, functionName, line) {
                    vscode.postMessage({
                        command: 'showPathCoverage',
                        filePath: decodeURIComponent(filePath),
                        functionName: decodeURIComponent(functionName),
                        line: line
                    });
                }
            </script>
        </body>
        </html>`;
}

function getGraphWebviewContent(
  graph: PathCoverageGraph,
  functionName: string,
  filePath: string
): string {
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    color:
      node.type === "entry"
        ? "#4CAF50"
        : node.type === "exit"
        ? "#F44336"
        : node.type === "decision"
        ? "#FF9800"
        : "#2196F3",
  }));

  const edges = graph.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    arrows: "to",
  }));

  const graphData = {
    nodes: nodes,
    edges: edges,
  };

  return `<!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Path Coverage - ${functionName}</title>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <style>
            body { 
                font-family: sans-serif; 
                padding: 20px; 
                color: var(--vscode-editor-foreground); 
                background-color: var(--vscode-editor-background); 
                margin: 0;
            }
            h1 { 
                border-bottom: 1px solid var(--vscode-panel-border); 
                padding-bottom: 5px; 
                margin-bottom: 20px;
            }
            #graphContainer {
                width: 100%;
                height: calc(100vh - 150px);
                border: 1px solid var(--vscode-panel-border);
                background-color: var(--vscode-editor-background);
            }
            .info {
                margin-bottom: 10px;
                font-size: 14px;
                color: var(--vscode-descriptionForeground);
            }
        </style>
    </head>
    <body>
        <h1>📈 Path Coverage Graph - ${functionName}</h1>
        <div class="info">
            <strong>Arquivo:</strong> ${path.basename(filePath)}<br>
            <strong>Função:</strong> ${functionName}<br>
            <strong>Total de Nós:</strong> ${graph.nodes.length} | 
            <strong>Total de Arestas:</strong> ${graph.edges.length}
        </div>
        <div id="graphContainer"></div>
        <script type="text/javascript">
            const nodes = new vis.DataSet(${JSON.stringify(nodes)});
            const edges = new vis.DataSet(${JSON.stringify(edges)});
            
            const container = document.getElementById('graphContainer');
            const data = { nodes: nodes, edges: edges };
            const options = {
                nodes: {
                    shape: 'box',
                    font: {
                        color: 'var(--vscode-editor-foreground)',
                        size: 14
                    },
                    borderWidth: 2,
                    shadow: true
                },
                edges: {
                    font: {
                        color: 'var(--vscode-editor-foreground)',
                        size: 12,
                        align: 'middle'
                    },
                    arrows: {
                        to: {
                            enabled: true,
                            scaleFactor: 1.2
                        }
                    },
                    smooth: {
                        type: 'cubicBezier',
                        forceDirection: 'horizontal',
                        roundness: 0.4
                    }
                },
                layout: {
                    hierarchical: {
                        direction: 'UD',
                        sortMethod: 'directed',
                        levelSeparation: 100,
                        nodeSpacing: 150
                    }
                },
                physics: {
                    enabled: false
                }
            };
            
            const network = new vis.Network(container, data, options);
        </script>
    </body>
    </html>`;
}

export function showAnalysisResults(
  results: ProjectAnalysisResultItem[],
  context: vscode.ExtensionContext
) {
  const panel = vscode.window.createWebviewPanel(
    "complexityReport",
    "Complexidade Ciclomática",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent(results);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === "showPathCoverage") {
        try {
          const { filePath, functionName, line } = message;

          if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(
              `Arquivo não encontrado: ${filePath}`
            );
            return;
          }

          const code = fs.readFileSync(filePath, "utf8");
          const functionNode = findFunctionInCode(code, functionName, line);

          if (!functionNode) {
            vscode.window.showErrorMessage(
              `Função "${functionName}" não encontrada na linha ${line}`
            );
            return;
          }

          const graph = generatePathCoverageGraph(functionNode);

          const graphPanel = vscode.window.createWebviewPanel(
            "pathCoverageGraph",
            `Path Coverage - ${functionName}`,
            vscode.ViewColumn.Two,
            {
              enableScripts: true,
              retainContextWhenHidden: true,
            }
          );

          graphPanel.webview.html = getGraphWebviewContent(
            graph,
            functionName,
            filePath
          );
        } catch (error) {
          vscode.window.showErrorMessage(`Erro ao gerar grafo: ${error}`);
          console.error("Erro ao gerar grafo:", error);
        }
      }
    },
    undefined,
    context.subscriptions
  );
}
