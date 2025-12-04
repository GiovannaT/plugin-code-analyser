// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import {
  analyzeFile,
  FunctionComplexityResult,
  FileComplexityResult,
} from "./analysis/analyser";
import { showAnalysisResults } from "./ui/resultViewer";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    "Complexidade Ciclomática - Relatório"
  );
  context.subscriptions.push(outputChannel);

  console.log('Congratulations, your extension "code-analyser" is now active!');
  const disposableActiveFile = vscode.commands.registerCommand(
    "code-analyser.analyzeActiveFile",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("Nenhum arquivo ativo para análise.");
        return;
      }

      const document = editor.document;
      const filePath = document.fileName;

      // Verifica se é um arquivo JS/TS
      if (!document.languageId.match(/javascript|typescript|json/i)) {
        vscode.window.showWarningMessage(
          "A análise é suportada apenas para arquivos JavaScript e TypeScript."
        );
        return;
      }

      vscode.window.showInformationMessage(
        `Iniciando análise de: ${path.basename(filePath)}...`
      );

      const code = document.getText();

      // 🎯 Chama sua lógica de análise e recebe o novo objeto FileComplexityResult
      const fileResult: FileComplexityResult = analyzeFile(code, filePath);

      // 🎯 Exibe os resultados no Output Panel
      outputChannel.clear();
      outputChannel.show(true); // Garante que o painel seja visível

      outputChannel.appendLine(
        "================================================="
      );
      outputChannel.appendLine(
        `📊 RELATÓRIO DE COMPLEXIDADE C. - ${path.basename(filePath)}`
      );
      outputChannel.appendLine(
        "================================================="
      );

      // Imprimindo as novas propriedades agregadas
      outputChannel.appendLine(
        `TOTAL DE FUNÇÕES ANALISADAS: ${fileResult.totalFunctions}`
      );
      outputChannel.appendLine(
        `COMPLEXIDADE CICLOMÁTICA MÉDIA: ${fileResult.averageComplexity.toFixed(
          2
        )}`
      );
      outputChannel.appendLine(
        "-------------------------------------------------"
      );

      if (fileResult.totalFunctions === 0) {
        outputChannel.appendLine(
          "Nenhuma função ou método detectado neste arquivo."
        );
      } else {
        // Imprime os detalhes função por função (usando fileResult.functions)
        outputChannel.appendLine("DETALHES FUNÇÃO POR FUNÇÃO:");
        fileResult.functions.forEach((func) => {
          outputChannel.appendLine(
            `[CC: ${func.complexity.toString().padEnd(3)}] ${
              func.name
            } (Linha ${func.line})`
          );
        });
      }
      outputChannel.appendLine(
        "================================================="
      );

      vscode.window.showInformationMessage(
        `CC Média do Arquivo: ${fileResult.averageComplexity.toFixed(
          2
        )}. Veja detalhes no Painel de Output.`
      );
    }
  );

  context.subscriptions.push(disposableActiveFile);

  const disposable = vscode.commands.registerCommand(
    "code-analyser.analyzeProject",
    async () => {
      // 1. Mostrar que a análise começou
      vscode.window.showInformationMessage(
        "Iniciando análise de Complexidade Ciclomática..."
      );

      // 2. Encontrar todos os arquivos JS/TS (excluindo node_modules)
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,js,tsx,jsx}",
        "**/node_modules/**"
      );

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          "Nenhum arquivo JS/TS encontrado no workspace."
        );
        return;
      }

      const projectResults: {
        filePath: string;
        functions: FunctionComplexityResult[];
      }[] = [];

      // Removido: A lógica de pegar apenas o 'editor ativo' foi removida para focar no projeto.

      // 3. Processar cada arquivo e mostrar progresso
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Análise de Complexidade em Progresso...",
          cancellable: false,
        },
        async (progress) => {
          for (let i = 0; i < files.length; i++) {
            const fileUri = files[i];

            progress.report({
              message: `Analisando: ${path.basename(fileUri.fsPath)}`,
              increment: (1 / files.length) * 100,
            });

            // Leitura do arquivo (API nativa do VS Code)
            const fileContentBuffer = await vscode.workspace.fs.readFile(
              fileUri
            );
            const fileContent = Buffer.from(fileContentBuffer).toString("utf8");

            // Chama a sua lógica de análise
            const results = analyzeFile(fileContent, fileUri.fsPath);

            projectResults.push({
              filePath: fileUri.fsPath,
              functions: results.functions,
            });
          }
        }
      );

      // 4. Finalizar e Mostrar Resultados
      const totalFiles = projectResults.length;
      const totalFunctions = projectResults.reduce(
        (sum, f) => sum + f.functions.length,
        0
      );

      const viewResultsButton = "Ver Relatório";
      const dismissButton = "Fechar";

      const selectedAction = await vscode.window.showInformationMessage(
        `Análise de Complexidade Finalizada! Arquivos: ${totalFiles}, Funções: ${totalFunctions}.`,
        // Argumentos que definem os botões:
        { modal: false },
        viewResultsButton,
        dismissButton
      );

      // Trata a ação selecionada pelo usuário
      if (selectedAction === viewResultsButton) {
        // 🎯 CHAMADA FINAL AQUI
        showAnalysisResults(projectResults, context);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
