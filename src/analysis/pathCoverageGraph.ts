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
  statements.forEach((stmt) => {
    if (
      DIRECT_DECISION_NODES.includes(stmt.type) ||
      stmt.type === "SwitchStatement"
    ) {
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
      const currentNodeId = createAndConnectNode(
        stmt,
        nodes,
        edges,
        source,
        filePath,
        lastEndNodeId,
        "",
        "process",
        true
      );
      lastEndNodeId = currentNodeId;
    }
  });

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

  let endNodes: string [] = [currentNodeId];

  if (node.type === "IfStatement") {
    const endNodesList: string[] = [];
    const conditionId = currentNodeId;

    // True Branch (Consequent)
    if (node.consequent) {
      const consequentEnds = buildGraphFromNode(
        node.consequent as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        conditionId,
        "T", // Label 'T'
        true
      );
      endNodesList.push(...consequentEnds);
    }

    // False Branch (Alternate)
    if (node.alternate) {
      const alternateEnds = buildGraphFromNode(
        node.alternate as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        conditionId,
        "F", // Label 'F'
        false
      );
      endNodesList.push(...alternateEnds);
    } else {
        // Se não houver 'else', o fluxo falso sai da decisão e segue para o próximo BB
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
        (node as TSESTree.WhileStatement | TSESTree.ForStatement).body as TSESTree.Node,
        nodes,
        edges,
        source,
        filePath,
        currentNodeId,
        "T" // Aresta de entrada no corpo (True)
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
    // Se não houver casos, o fluxo sai do SWITCH sem entrar em nenhum case
    endNodes = endNodesList.length > 0 ? endNodesList : [currentNodeId];

  } else if (node.type === "SwitchCase") {
    // SwitchCase: o corpo do case é uma sequência de statements (BBs)
    if (node.consequent && Array.isArray(node.consequent)) {
        // O corpo do case começa após o nó CASE (currentNodeId)
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
        // Case vazio
        endNodes = [currentNodeId];
    }
  }

  // 3. Nó de Processo Simples (BB)
  // Se o nó for um statement simples (como ReturnStatement, ExpressionStatement, etc.),
  // ele já foi criado no passo 1 e não tem corpo para processar.
  // Ele apenas retorna seu próprio ID como o nó de saída.

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
    // O corpo da função (geralmente um BlockStatement) é o primeiro grande BB
    // que é processado a partir do ENTRY.
    endNodeIds = buildGraphFromNode(
      bodyNode as TSESTree.Node,
      nodes,
      edges,
      sourceCode,
      filePath,
      entryNodeId,
      "", // Aresta de ENTRY para o corpo é vazia
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
