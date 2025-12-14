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

interface MetricsFile {
  metrics: MetricData[];
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]/g, "_");
}

function getPreviousComplexity(metricFilePath: string): number | null {
  if (!fs.existsSync(metricFilePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metricFilePath, "utf8");
    const metricsFile: MetricsFile = JSON.parse(content);
    
    if (metricsFile.metrics && metricsFile.metrics.length > 0) {
      const lastMetric = metricsFile.metrics[metricsFile.metrics.length - 1];
      return lastMetric.metricValue;
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao ler métrica anterior:", error);
    return null;
  }
}

function getLastMetric(metricFilePath: string): MetricData | null {
  if (!fs.existsSync(metricFilePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metricFilePath, "utf8");
    const metricsFile: MetricsFile = JSON.parse(content);
    
    if (metricsFile.metrics && metricsFile.metrics.length > 0) {
      return metricsFile.metrics[metricsFile.metrics.length - 1];
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao ler última métrica:", error);
    return null;
  }
}

function calculateTrend(currentValue: number, previousValue: number | null): string {
  if (previousValue === null) {
    return "Nova";
  }
  
  if (currentValue > previousValue) {
    return "Aumentando";
  } else if (currentValue < previousValue) {
    return "Diminuindo";
  } else {
    return "Estável";
  }
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
        const metricFileName = `${sanitizedFileName}_${sanitizedFunctionName}_L${func.line}.json`;
        const metricFilePath = path.join(metricsFolder, metricFileName);

        const previousComplexity = getPreviousComplexity(metricFilePath);
        const trend = calculateTrend(func.complexity, previousComplexity);
        const lastMetric = getLastMetric(metricFilePath);

        let metricsFile: MetricsFile;
        if (fs.existsSync(metricFilePath)) {
          const content = fs.readFileSync(metricFilePath, "utf8");
          metricsFile = JSON.parse(content);

          if (
            lastMetric &&
            lastMetric.changeTrend === "Estável" &&
            trend === "Estável" &&
            lastMetric.metricValue === func.complexity
          ) {
            lastMetric.modified = new Date().toISOString();
          } else {
            const metricData: MetricData = {
              metricName: "complexity metric",
              regionName: `${func.name} (${path.basename(fileResult.filePath)}:${
                func.line
              })`,
              metricValue: func.complexity,
              modified: new Date().toISOString(),
              changeTrend: trend,
              limit: averageComplexity,
            };
            metricsFile.metrics.push(metricData);
          }
        } else {
          const metricData: MetricData = {
            metricName: "complexity metric",
            regionName: `${func.name} (${path.basename(fileResult.filePath)}:${
              func.line
            })`,
            metricValue: func.complexity,
            modified: new Date().toISOString(),
            changeTrend: trend,
            limit: averageComplexity,
          };
          metricsFile = {
            metrics: [metricData],
          };
        }

        fs.writeFileSync(
          metricFilePath,
          JSON.stringify(metricsFile, null, 2),
          "utf8"
        );
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
      const metricFileName = `${sanitizedFileName}_${sanitizedFunctionName}_L${func.line}.json`;
      const metricFilePath = path.join(metricsFolder, metricFileName);

      const previousComplexity = getPreviousComplexity(metricFilePath);
      const trend = calculateTrend(func.complexity, previousComplexity);
      const lastMetric = getLastMetric(metricFilePath);

      let metricsFile: MetricsFile;
      if (fs.existsSync(metricFilePath)) {
        const content = fs.readFileSync(metricFilePath, "utf8");
        metricsFile = JSON.parse(content);

        if (
          lastMetric &&
          lastMetric.changeTrend === "Estável" &&
          trend === "Estável" &&
          lastMetric.metricValue === func.complexity
        ) {
          lastMetric.modified = new Date().toISOString();
        } else {
          const metricData: MetricData = {
            metricName: "complexity metric",
            regionName: `${func.name} (${path.basename(filePath)}:${func.line})`,
            metricValue: func.complexity,
            modified: new Date().toISOString(),
            changeTrend: trend,
            limit: projectAverageComplexity,
          };
          metricsFile.metrics.push(metricData);
        }
      } else {
        const metricData: MetricData = {
          metricName: "complexity metric",
          regionName: `${func.name} (${path.basename(filePath)}:${func.line})`,
          metricValue: func.complexity,
          modified: new Date().toISOString(),
          changeTrend: trend,
          limit: projectAverageComplexity,
        };
        metricsFile = {
          metrics: [metricData],
        };
      }

      fs.writeFileSync(
        metricFilePath,
        JSON.stringify(metricsFile, null, 2),
        "utf8"
      );
    }
  } catch (error) {
    console.error("Erro ao exportar métricas do arquivo:", error);
    throw error;
  }
}
