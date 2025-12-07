import { TSESTree } from "@typescript-eslint/typescript-estree";

export interface GraphNode {
  id: string;
  label: string;
  type: "entry" | "decision" | "process" | "exit";
  line?: number;
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
      return "PROCESS";
  }
}

function buildGraphFromNode(
  node: TSESTree.Node,
  nodes: GraphNode[],
  edges: GraphEdge[],
  parentNodeId?: string,
  isTrueBranch: boolean = true
): string[] {
  const currentNodeId = getNodeId();
  const nodeType = DIRECT_DECISION_NODES.includes(node.type)
    ? "decision"
    : node.type === "SwitchCase"
    ? "decision"
    : "process";

  const label = getNodeLabel(node);
  const line = node.loc.start.line;
  console.log(line)

  nodes.push({
    id: currentNodeId,
    label: `${label}${line ? ` (L${line})` : "teste"}`,
    type: nodeType,
    line: line,
  });

  if (parentNodeId) {
    edges.push({
      from: parentNodeId,
      to: currentNodeId,
      label: isTrueBranch ? "T" : "F",
    });
  }

  let endNodes: string[] = [currentNodeId];

  if (node.type === "IfStatement") {
    const conditionId = currentNodeId;
    const endNodesList: string[] = [];

    if (node.consequent) {
      const consequentEnds = buildGraphFromNode(
        node.consequent as TSESTree.Node,
        nodes,
        edges,
        conditionId,
        true
      );
      endNodesList.push(...consequentEnds);
    }
    if (node.alternate) {
      const alternateEnds = buildGraphFromNode(
        node.alternate as TSESTree.Node,
        nodes,
        edges,
        conditionId,
        false
      );
      endNodesList.push(...alternateEnds);
    }

    endNodes = endNodesList.length > 0 ? endNodesList : [conditionId];
  } else if (
    node.type === "WhileStatement" ||
    node.type === "DoWhileStatement"
  ) {
    if (node.body) {
      const bodyEnds = buildGraphFromNode(
        node.body as TSESTree.Node,
        nodes,
        edges,
        currentNodeId,
        true
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
  } else if (node.type === "ForStatement") {
    if (node.body) {
      const bodyEnds = buildGraphFromNode(
        node.body as TSESTree.Node,
        nodes,
        edges,
        currentNodeId,
        true
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
    if (node.consequent) {
      endNodesList.push(
        ...buildGraphFromNode(
          node.consequent as TSESTree.Node,
          nodes,
          edges,
          currentNodeId,
          true
        )
      );
    }
    if (node.alternate) {
      endNodesList.push(
        ...buildGraphFromNode(
          node.alternate as TSESTree.Node,
          nodes,
          edges,
          currentNodeId,
          false
        )
      );
    }
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
            currentNodeId,
            true
          )
        );
      });
    }
    endNodes = endNodesList.length > 0 ? endNodesList : [currentNodeId];
  } else if (node.type === "SwitchCase") {
    const endNodesList: string[] = [];
    if (node.consequent && Array.isArray(node.consequent)) {
      let lastEnds: string[] = [currentNodeId];
      node.consequent.forEach((stmt) => {
        const stmtEnds = buildGraphFromNode(
          stmt as TSESTree.Node,
          nodes,
          edges,
          lastEnds[lastEnds.length - 1],
          true
        );
        lastEnds = stmtEnds;
      });
      endNodesList.push(...lastEnds);
    }
    endNodes = endNodesList.length > 0 ? endNodesList : [currentNodeId];
  } else if (node.type === "BlockStatement") {
    const endNodesList: string[] = [];
    if (node.body && Array.isArray(node.body)) {
      let lastEnds: string[] = [currentNodeId];
      node.body.forEach((stmt) => {
        const stmtEnds = buildGraphFromNode(
          stmt as TSESTree.Node,
          nodes,
          edges,
          lastEnds[lastEnds.length - 1],
          true
        );
        lastEnds = stmtEnds;
      });
      endNodesList.push(...lastEnds);
    }
    endNodes = endNodesList.length > 0 ? endNodesList : [currentNodeId];
  } else {
    endNodes = [currentNodeId];
  }

  return endNodes;
}

export function generatePathCoverageGraph(
  functionNode: TSESTree.Node
): PathCoverageGraph {
  nodeCounter = 0;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const entryNodeId = getNodeId();
  nodes.push({
    id: entryNodeId,
    label: "ENTRY",
    type: "entry",
  });

  let endNodeIds: string[] = [entryNodeId];

  const functionNodeWithBody = functionNode as { body: TSESTree.Node | null };

  if (functionNodeWithBody.body) {
    const bodyNode = functionNodeWithBody.body;
    endNodeIds = buildGraphFromNode(
      bodyNode as TSESTree.Node,
      nodes,
      edges,
      entryNodeId,
      true
    );
  }

  const exitNodeId = getNodeId();
  nodes.push({
    id: exitNodeId,
    label: "EXIT",
    type: "exit",
  });

  const uniqueEndNodes = [...new Set(endNodeIds)];
  uniqueEndNodes.forEach((nodeId) => {
    if (nodeId !== exitNodeId && nodeId !== entryNodeId) {
      edges.push({
        from: nodeId,
        to: exitNodeId,
        label: "",
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
