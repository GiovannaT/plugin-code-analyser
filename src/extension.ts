import * as vscode from "vscode";
import * as path from "path";
import {
  analyzeFile,
  FunctionComplexityResult,
  FileComplexityResult,
} from "./analysis/analyser";
import { showAnalysisResults } from "./ui/resultViewer";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    "Complexidade Ciclomática - Relatório"
  );
  context.subscriptions.push(outputChannel);

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

      const fileResult: FileComplexityResult = analyzeFile(code, filePath);

      outputChannel.clear();
      outputChannel.show(true);

      outputChannel.appendLine(
        "================================================="
      );
      outputChannel.appendLine(
        `📊 RELATÓRIO DE COMPLEXIDADE C. - ${path.basename(filePath)}`
      );
      outputChannel.appendLine(
        "================================================="
      );

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
      vscode.window.showInformationMessage(
        "Iniciando análise de Complexidade Ciclomática..."
      );

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

            const fileContentBuffer = await vscode.workspace.fs.readFile(
              fileUri
            );
            const fileContent = Buffer.from(fileContentBuffer).toString("utf8");

            const results = analyzeFile(fileContent, fileUri.fsPath);

            projectResults.push({
              filePath: fileUri.fsPath,
              functions: results.functions,
            });
          }
        }
      );

      const totalFiles = projectResults.length;
      const totalFunctions = projectResults.reduce(
        (sum, f) => sum + f.functions.length,
        0
      );

      const viewResultsButton = "Ver Relatório";
      const dismissButton = "Fechar";

      const selectedAction = await vscode.window.showInformationMessage(
        `Análise de Complexidade Finalizada! Arquivos: ${totalFiles}, Funções: ${totalFunctions}.`,
        { modal: false },
        viewResultsButton,
        dismissButton
      );

      if (selectedAction === viewResultsButton) {
        showAnalysisResults(projectResults, context);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
