// Defines deterministic quality checks and standard assumptions for architecture bootstrap proposals.
import type { ArchitectureChangeProposal } from './contracts';
import { applyArchitectureOperations } from './operations';
import type { ArchitectureGraph } from '@/lib/types/architectureTypes';

export const standardArchitectureBootstrapAssumptions = [
  'Standard assumption: the first release uses managed infrastructure with separate development, staging, and production environments.',
  'Standard assumption: authentication, authorization, encryption in transit, and least-privilege access are required at service and data boundaries.',
  'Standard assumption: the ingestion path is asynchronous where workload spikes or downstream availability could delay user requests.',
  'Standard assumption: operational telemetry is retained separately from product data and is available to authenticated operators.',
] as const;

type BootstrapCoverage = {
  application: boolean;
  data: boolean;
  ingestion: boolean;
  infrastructure: boolean;
  security: boolean;
  observability: boolean;
  technologyDecisions: boolean;
  responsibilities: boolean;
  relationships: boolean;
  assumptions: boolean;
};

export type ArchitectureBootstrapQuality = {
  passed: boolean;
  issues: string[];
  coverage: BootstrapCoverage;
};

const applicationTypes = new Set(['application', 'frontend', 'service', 'backend_domain', 'api', 'gateway']);
const dataTypes = new Set(['database', 'storage', 'cache', 'queue', 'event_bus']);
const infrastructureTypes = new Set(['cloud_resource', 'network_boundary', 'deployment_environment', 'gateway']);
const securityTypes = new Set(['security_control', 'trust_boundary']);
const observabilityTypes = new Set(['monitoring', 'observability']);

// Tests whether a bootstrap graph names a meaningful ingestion or processing pipeline component.
function hasIngestionCoverage(text: string) {
  return /ingest|collector|exporter|pipeline|telemetry|event bus|queue|stream|worker|webhook|consumer|producer/.test(text);
}

// Tests whether a component belongs to a category based on its type or descriptive content.
function hasCategory(component: { type: string; name: string; description: string | null; responsibilities: string[] }, types: Set<string>, pattern?: RegExp) {
  const text = [component.name, component.description || '', ...component.responsibilities].join(' ').toLowerCase();
  return types.has(component.type) || Boolean(pattern?.test(text));
}

// Evaluates a bootstrap proposal against the minimum architecture coverage contract.
export function evaluateArchitectureBootstrapQuality(graph: ArchitectureGraph, proposal: ArchitectureChangeProposal): ArchitectureBootstrapQuality {
  const issues: string[] = [];
  let projected: ArchitectureGraph;
  try {
    projected = applyArchitectureOperations(graph, proposal.operations);
  } catch (error) {
    return { passed: false, issues: [`Projected architecture is invalid: ${error instanceof Error ? error.message : 'unknown validation error'}`], coverage: { application: false, data: false, ingestion: false, infrastructure: false, security: false, observability: false, technologyDecisions: false, responsibilities: false, relationships: false, assumptions: false } };
  }

  const components = projected.components;
  const componentText = components.map((component) => [component.name, component.description || '', ...component.responsibilities, ...component.technologies].join(' ')).join(' ').toLowerCase();
  const coverage: BootstrapCoverage = {
    application: components.some((component) => hasCategory(component, applicationTypes)),
    data: components.some((component) => hasCategory(component, dataTypes)),
    ingestion: components.some((component) => hasIngestionCoverage([component.name, component.description || '', ...component.responsibilities, ...component.technologies].join(' ').toLowerCase())),
    infrastructure: components.some((component) => hasCategory(component, infrastructureTypes, /deploy|runtime|network|cloud|environment|container|cluster/)),
    security: components.some((component) => hasCategory(component, securityTypes, /auth|security|identity|access|encrypt|secret|permission|trust/)),
    observability: components.some((component) => hasCategory(component, observabilityTypes, /observ|monitor|metric|log|trace|alert|telemetry/)),
    technologyDecisions: proposal.technicalDecisions.length >= 4 && proposal.technicalDecisions.every((decision) => decision.area.trim() && decision.choice.trim() && decision.rationale.trim()),
    responsibilities: components.filter((component) => component.responsibilities.length > 0).length >= 6 && componentText.length > 0,
    relationships: projected.relationships.length >= 8,
    assumptions: proposal.assumptions.filter((assumption) => /^standard assumption:/i.test(assumption.trim())).length >= 3,
  };

  for (const [key, present] of Object.entries(coverage)) if (!present) issues.push(`Bootstrap is missing meaningful ${key} coverage.`);
  if (components.length < 8) issues.push('Bootstrap must contain at least eight meaningful components.');
  return { passed: issues.length === 0, issues, coverage };
}

// Adds standard assumptions without discarding provider-specific assumptions.
export function withStandardArchitectureBootstrapAssumptions(assumptions: string[]) {
  return Array.from(new Set([...assumptions, ...standardArchitectureBootstrapAssumptions])).slice(0, 25);
}
