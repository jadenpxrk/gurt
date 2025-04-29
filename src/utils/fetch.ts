import { useState } from "react";

interface DebugResponse {
  new_code: string;
  thoughts: string[];
  time_complexity: string;
  space_complexity: string;
}

export const useMockDebug = () => {
  const [isLoading, setIsLoading] = useState(false);

  const mockDebugFetch = async (): Promise<DebugResponse> => {
    setIsLoading(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockResponse: DebugResponse = {
      new_code: `function solution(nums: number[]): number {
  const n = nums.length;
  if (n === 0) return 0;
  
  let maxSum = nums[0];
  let currentSum = nums[0];
  
  for (let i = 1; i < n; i++) {
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  
  return maxSum;
}`,
      thoughts: [
        "Analyzed the input array structure",
        "Implemented Kadane's algorithm for optimal performance",
        "Added edge case handling for empty arrays",
        "Improved variable naming for better readability",
      ],
      time_complexity: "O(n) where n is the length of the input array",
      space_complexity: "O(1) as we only use a constant amount of extra space",
    };

    setIsLoading(false);
    return mockResponse;
  };

  return {
    mockDebugFetch,
    isLoading,
  };
};

// Helper to simulate different debug scenarios
export const getMockDebugData = (
  scenario: "success" | "complex" | "error" = "success"
): DebugResponse => {
  const scenarios = {
    success: {
      new_code: `function findMax(arr: number[]): number {
  return Math.max(...arr);
}`,
      thoughts: [
        "Simplified the solution using built-in Math.max",
        "Improved readability with clear function naming",
        "Handled array spread operation for efficient processing",
      ],
      time_complexity: "O(n) where n is the array length",
      space_complexity: "O(1) constant space",
    },
    complex: {
      new_code: `class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  
  constructor(val: number) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

function balanceBST(root: TreeNode | null): TreeNode | null {
  if (!root) return null;
  
  const values: number[] = [];
  inorderTraversal(root, values);
  
  return buildBalancedBST(values, 0, values.length - 1);
}

function inorderTraversal(node: TreeNode | null, values: number[]): void {
  if (!node) return;
  inorderTraversal(node.left, values);
  values.push(node.val);
  inorderTraversal(node.right, values);
}

function buildBalancedBST(values: number[], start: number, end: number): TreeNode | null {
  if (start > end) return null;
  
  const mid = Math.floor((start + end) / 2);
  const node = new TreeNode(values[mid]);
  
  node.left = buildBalancedBST(values, start, mid - 1);
  node.right = buildBalancedBST(values, mid + 1, end);
  
  return node;
}`,
      thoughts: [
        "Implemented BST balancing using array conversion",
        "Used inorder traversal to maintain BST property",
        "Created helper functions for modular code structure",
        "Optimized space usage with in-place operations where possible",
      ],
      time_complexity: "O(n) for traversal and reconstruction",
      space_complexity: "O(n) for storing values array",
    },
    error: {
      new_code: "",
      thoughts: ["Error occurred during processing"],
      time_complexity: "N/A",
      space_complexity: "N/A",
    },
  };

  return scenarios[scenario];
};
