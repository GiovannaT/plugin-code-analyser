import * as fs from "fs";
import * as path from "path";
import { FunctionComplexityResult, FileComplexityResult } from "./analyser";

interface MetricData {
  metricName: string;
  regionName: string;
  metricValue: number;
  modified: string;
  changeTrend: string;
  limit: number;
}

function formatMetricFile(data: MetricData): string {
  return `Métrica : ${data.metricName}
Região : ${data.regionName}
Valor : ${data.metricValue}
Modificado : ${data.modified}
Tendência : ${data.changeTrend}
Limite : ${data.limit}`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]/g, "_");
}

function shouldExportMetric(
  complexity: number,
  averageComplexity: number
): boolean {
  if (averageComplexity === 0) return false;

  return complexity >= averageComplexity * 2;
}

export async function exportMetricsToFiles(
  results: {
    filePath: string;
    functions: FunctionComplexityResult[];
  }[],
  averageComplexity: number,
  workspaceRoot: string
): Promise<void> {
  try {
    const metricsFolder = path.join(workspaceRoot, "complexity-metrics");

    if (!fs.existsSync(metricsFolder)) {
      fs.mkdirSync(metricsFolder, { recursive: true });
    }

    for (const fileResult of results) {
      const fileName = path.basename(
        fileResult.filePath,
        path.extname(fileResult.filePath)
      );
      const sanitizedFileName = sanitizeFileName(fileName);

      for (const func of fileResult.functions) {
        if (!shouldExportMetric(func.complexity, averageComplexity)) {
          continue;
        }

        const sanitizedFunctionName = sanitizeFileName(func.name);
        const metricFileName = `${sanitizedFileName}_${sanitizedFunctionName}_L${func.line}.txt`;
        const metricFilePath = path.join(metricsFolder, metricFileName);

        const metricData: MetricData = {
          metricName: "complexity metric",
          regionName: `${func.name} (${path.basename(fileResult.filePath)}:${
            func.line
          })`,
          metricValue: func.complexity,
          modified: new Date().toISOString(),
          changeTrend: "N/A",
          limit: averageComplexity,
        };

        const content = formatMetricFile(metricData);
        const separator = "------------------------------\n";
        const newContent = fs.existsSync(metricFilePath)
          ? fs.readFileSync(metricFilePath, "utf8") + "\n" + separator + content
          : content;
        fs.writeFileSync(metricFilePath, newContent, "utf8");
      }
    }
  } catch (error) {
    console.error("Erro ao exportar métricas:", error);
    throw error;
  }
}

export async function exportFileMetrics(
  fileResult: FileComplexityResult,
  filePath: string,
  workspaceRoot: string,
  projectAverageComplexity: number
): Promise<void> {
  try {
    const metricsFolder = path.join(workspaceRoot, "complexity-metrics");

    if (!fs.existsSync(metricsFolder)) {
      fs.mkdirSync(metricsFolder, { recursive: true });
    }

    const fileName = path.basename(filePath, path.extname(filePath));
    const sanitizedFileName = sanitizeFileName(fileName);

    for (const func of fileResult.functions) {
      if (!shouldExportMetric(func.complexity, projectAverageComplexity)) {
        continue;
      }

      const sanitizedFunctionName = sanitizeFileName(func.name);
      const metricFileName = `${sanitizedFileName}_${sanitizedFunctionName}_L${func.line}.txt`;
      const metricFilePath = path.join(metricsFolder, metricFileName);

      const metricData: MetricData = {
        metricName: "complexity metric",
        regionName: `${func.name} (${path.basename(filePath)}:${func.line})`,
        metricValue: func.complexity,
        modified: new Date().toISOString(),
        changeTrend: "N/A",
        limit: projectAverageComplexity,
      };

      const content = formatMetricFile(metricData);
      const separator = "------------------------------\n";
      const newContent = fs.existsSync(metricFilePath)
        ? fs.readFileSync(metricFilePath, "utf8") + "\n" + separator + content
        : content;
      fs.writeFileSync(metricFilePath, newContent, "utf8");
    }
  } catch (error) {
    console.error("Erro ao exportar métricas do arquivo:", error);
    throw error;
  }
}
