/* istanbul ignore file */ 
// Tells Istanbul (code coverage tool) to ignore this file during coverage reporting

import { Issue } from "./types"; // Import Issue type definition

// Helper function to generate a unique key for an Issue
function key(i: Issue) {
  // Combines type, section, and trimmed description into a single string
  // This allows easy comparison and deduplication using Sets
  return `${i.type}|${i.section}|${i.description.trim()}`;
}

export function intersectIssues(runs: { issues: Issue[] }[]): Issue[] {
  // If no runs are provided, return empty result
  if (!runs.length) return [];

  // Convert each run's issues into a Set of unique keys
  const sets = runs.map(r => new Set(r.issues.map(key)));

  // Take the first set and filter keys that exist in ALL sets
  const common = [...sets[0]].filter(k =>
    sets.every(s => s.has(k)) // ensures the key is present in every run
  );

  // Convert the common keys back into Issue objects
  return common.map(k => {
    // Split the key back into its original components
    const [type, section, description] = k.split("|");

    return { 
      type: type as Issue["type"], // cast back to Issue type
      section, 
      description 
    };
  });
}