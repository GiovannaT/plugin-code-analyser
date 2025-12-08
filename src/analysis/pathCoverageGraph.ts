import { TSESTree } from "@typescript-eslint/typescript-estree";

export interface GraphNode {
  id: string;
  label: string;
  type: "entry" | "decision" | "process" | "exit";
  filePath: string;
  range?: [number, number];
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  line?: number;
  code?: string;
  isBasicBlock?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface PathCoverageGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DIRECT_DECISION_NODES = [
  "IfStatement",
  "ForStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ConditionalExpression",
  "CatchClause",
  "SwitchCase",
];

let nodeCounter = 0;

function getNodeId(): string {
  return `node_${nodeCounter++}`;
}

function getNodeLabel(node: TSESTree.Node): string {
  switch (node.type) {
    case "IfStatement":
      return "IF";
    case "ForStatement":
      return "FOR";
    case "WhileStatement":
      return "WHILE";
    case "DoWhileStatement":
      return "DO-WHILE";
    case "ConditionalExpression":
      return "TERNARY";
    case "CatchClause":
      return "CATCH";
    case "SwitchStatement":
      return "SWITCH";
    case "SwitchCase":
      return "CASE";
    default:
      return "BB-PROCESS";
  }
}

function mergeBasicBlocks(
  basicBlockStatements: TSESTree.Statement[],
  nodes: GraphNode[],
  edges: GraphEdge[],
  source: string,
  filePath: string,
  startNodeId: string | null
): string {
  if (basicBlockStatements.length === 0) {
    return startNodeId!;
  }

  const firstNode = basicBlockStatements[0];
  const lastNode = basicBlockStatements[basicBlockStatements.length - 1];

  const mergedRange: [number, number] = [firstNode.range[0], lastNode.range[1]];
  const mergedLoc = { start: firstNode.loc?.start, end: lastNode.loc?.end };
  let code: string | undefined = undefined;
  if (mergedRange[0] < mergedRange[1]) {
    code = source.slice(mergedRange[0], mergedRange[1]);
  }

  const mergedNodeId = getNodeId();
  nodes.push({
    id: mergedNodeId,
    label: `BB-PROCESS (L${firstNode.loc?.start?.line}-L${lastNode.loc?.end?.line})`,
    type: "process",
    filePath: filePath,
    isBasicBlock: true,
    range: mergedRange,
    loc: mergedLoc,
    code: code,
  });

  edges.push({
    from: startNodeId!,
    to: mergedNodeId,
    label: "BB-PROCESS",
  });

  return mergedNodeId;
}

function createAndConnectNode(
  node: TSESTree.Node,
  nodes: GraphNode[],
  edges: GraphEdge[],
  source: string,
  filePath: string,
  parentNodeId: string | null,
  edgeLabel: string,
  type: GraphNode["type"],
  isBasicBlock: boolean = false
): string {
  const currentNodeId = getNodeId();
  const label = getNodeLabel(node);
  const line = node.loc?.start.line;
  const loc = node.loc;

  let code: string | undefined = undefined;
  if (node.range && node.range.length === 2 && node.range[0] < node.range[1]) {
    code = source.slice(node.range[0], node.range[1]);
  }
  nodes.push({
    id: currentNodeId,
    label: `${label}${line ? ` (L${line})` : ""}`,
    type: type,
    line: line,
    code,
    filePath,
    range: node.range as [number, number],
    loc: loc as GraphNode["loc"],
    isBasicBlock: isBasicBlock,
  });
  if (parentNodeId) {
    edges.push({
      from: parentNodeId,
      to: currentNodeId,
      label: edgeLabel,
    });
  }

  return currentNodeId;
}

function processStatementSequence(
  statements: TSESTree.Statement[],
  nodes: GraphNode[],
  edges: GraphEdge[],
  source: string,
  filePath: string,
  startNodeId: string
): string {
  let lastEndNodeId: string = startNodeId;
  let basicBlockStatements: TSESTree.Statement[] = [];

  statements.forEach((stmt) => {
    if (
      DIRECT_DECISION_NODES.includes(stmt.type) ||
      stmt.type === "SwitchStatement"
    ) {
      lastEndNodeId = mergeBasicBlocks(
        basicBlockStatements,
        nodes,
        edges,
        source,
        filePath,
        lastEndNodeId
      );
      basicBlockStatements = [];
      const decisionEnds = buildGraphFromNode(
        stmt as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        lastEndNodeId,
        "",
        true
      );
      lastEndNodeId = decisionEnds[0] || lastEndNodeId;
    } else {
      basicBlockStatements.push(stmt);
    }
  });

  lastEndNodeId = mergeBasicBlocks(
    basicBlockStatements,
    nodes,
    edges,
    source,
    filePath,
    lastEndNodeId
  );
  return lastEndNodeId;
}

function buildGraphFromNode(
  node: TSESTree.Node,
  nodes: GraphNode[],
  edges: GraphEdge[],
  source: string,
  filePath: string,
  parentNodeId: string,
  edgeLabel: string,
  isTrueBranch: boolean = true
): string[] {
  if (node.type === "BlockStatement") {
    return node.body && Array.isArray(node.body)
      ? [
          processStatementSequence(
            node.body,
            nodes,
            edges,
            source,
            filePath,
            parentNodeId!
          ),
        ]
      : [parentNodeId!];
  }
  const currentNodeId = createAndConnectNode(
    node,
    nodes,
    edges,
    source,
    filePath,
    parentNodeId,
    edgeLabel,
    DIRECT_DECISION_NODES.includes(node.type) || node.type === "SwitchCase"
      ? "decision"
      : "process",
    false
  );

  let endNodes: string[] = [currentNodeId];

  if (node.type === "IfStatement") {
    const endNodesList: string[] = [];
    const conditionId = currentNodeId;

    if (node.consequent) {
      const consequentEnds = buildGraphFromNode(
        node.consequent as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        conditionId,
        "T",
        true
      );
      endNodesList.push(...consequentEnds);
    }

    if (node.alternate) {
      const alternateEnds = buildGraphFromNode(
        node.alternate as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        conditionId,
        "F",
        false
      );
      endNodesList.push(...alternateEnds);
    } else {
      endNodesList.push(conditionId);
    }

    endNodes = endNodesList.length > 0 ? endNodesList : [conditionId];
  } else if (
    node.type === "WhileStatement" ||
    node.type === "DoWhileStatement" ||
    node.type === "ForStatement"
  ) {
    if ((node as TSESTree.WhileStatement | TSESTree.ForStatement).body) {
      const bodyEnds = buildGraphFromNode(
        (node as TSESTree.WhileStatement | TSESTree.ForStatement)
          .body as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        currentNodeId,
        "T"
      );
      bodyEnds.forEach((endId) => {
        edges.push({
          from: endId,
          to: currentNodeId,
          label: "LOOP",
        });
      });
    }
    endNodes = [currentNodeId];
  } else if (node.type === "ConditionalExpression") {
    const endNodesList: string[] = [];
    endNodesList.push(
      ...buildGraphFromNode(
        node.consequent as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        currentNodeId,
        "T",
        true
      )
    );

    endNodesList.push(
      ...buildGraphFromNode(
        node.alternate as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        currentNodeId,
        "F",
        false
      )
    );
    endNodes = endNodesList.length > 0 ? endNodesList : [currentNodeId];
  } else if (node.type === "SwitchStatement") {
    const endNodesList: string[] = [];
    if (node.cases && Array.isArray(node.cases)) {
      node.cases.forEach((caseNode) => {
        endNodesList.push(
          ...buildGraphFromNode(
            caseNode as TSESTree.Node,
            nodes,
            edges,
            source,
            filePath,
            currentNodeId,
            ""
          )
        );
      });
    }
    endNodes = endNodesList.length > 0 ? endNodesList : [currentNodeId];
  } else if (node.type === "SwitchCase") {
    if (node.consequent && Array.isArray(node.consequent)) {
      const caseEndId = processStatementSequence(
        node.consequent,
        nodes,
        edges,
        source,
        filePath,
        currentNodeId
      );
      endNodes = [caseEndId];
    } else {
      endNodes = [currentNodeId];
    }
  }

  return endNodes;
}

export function generatePathCoverageGraph(
  functionNode: TSESTree.Node,
  sourceCode: string,
  filePath: string
): PathCoverageGraph {
  nodeCounter = 0;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const entryNodeId = getNodeId();
  nodes.push({
    id: entryNodeId,
    label: "ENTRY",
    type: "entry",
    filePath: filePath,
  });

  let endNodeIds: string[] = [entryNodeId];

  const functionNodeWithBody = functionNode as { body: TSESTree.Node | null };

  if (functionNodeWithBody.body) {
    const bodyNode = functionNodeWithBody.body;
    endNodeIds = buildGraphFromNode(
      bodyNode as TSESTree.Node,
      nodes,
      edges,
      sourceCode,
      filePath,
      entryNodeId,
      "",
      true
    );
  }

  const exitNodeId = getNodeId();
  nodes.push({
    id: exitNodeId,
    label: "EXIT",
    type: "exit",
    filePath: filePath,
  });

  const uniqueEndNodes = [...new Set(endNodeIds)];
  uniqueEndNodes.forEach((nodeId) => {
    if (nodeId !== exitNodeId && nodeId !== entryNodeId) {
      edges.push({
        from: nodeId,
        to: exitNodeId,
        label: "Return/End",
      });
    }
  });

  if (uniqueEndNodes.length === 1 && uniqueEndNodes[0] === entryNodeId) {
    edges.push({
      from: entryNodeId,
      to: exitNodeId,
      label: "",
    });
  }

  return { nodes, edges };
}
