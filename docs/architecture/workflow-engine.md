# RitsuFlow™ Visual Workflow Architecture

Status: R&D architecture candidate
Branch: feat/workflow-lab-rete
Decision gate: Rete.js proof of concept passed

## 1. Architectural principle

Rete.js is the visual orchestration and configuration layer. It is not the authoritative RitsuFlow business engine.

The canonical business rules remain in RitsuFlow application/domain services and Supabase. A workflow node may request a canonical operation, but must not create a second implementation of that operation.

This keeps the platform operable if the visual editor is disabled or replaced in the future.

## 2. Layers

### Visual layer
Rete.js renders nodes, sockets, connections, configuration, validation state, and workflow versions.

### Workflow definition layer
Stores what the graph means: node type, configuration, edges, conditions, version, project/tenant scope, and publication status.

### Orchestration layer
Evaluates a published workflow definition and routes work through conditions. It calls canonical RitsuFlow services rather than writing directly to feature tables.

### Domain service layer
Existing or extracted canonical services for operations such as readiness evaluation, constraint creation, weekly-plan eligibility, status changes, notifications, and history events.

### Data layer
Supabase/PostgreSQL remains authoritative for project data, workflow definitions, workflow runs, events, and tenant isolation.

## 3. First production candidate

The first candidate workflow is the planning control loop:

Lookahead -> Readiness Check -> Decision

READY -> Weekly Plan Eligibility
NOT READY -> Constraint Management -> Resolution -> Readiness Recheck

This reflects the existing RitsuFlow rule that commitments should only proceed when work is clear/ready.

## 4. Node categories

Trigger nodes start or resume a workflow.
Examples: activity enters lookahead window; readiness answer changes; constraint resolved.

Condition nodes evaluate canonical state without mutating project data.
Examples: all readiness categories clear; constraint overdue; location mapped.

Action nodes call a canonical RitsuFlow service.
Examples: create constraint; mark weekly-plan eligible; assign responsible party; append history event.

Terminal nodes represent an outcome.
Examples: ready for weekly planning; action required; workflow completed.

## 5. Proposed persistence model (design only — not yet implemented)

workflow_definitions
- id
- tenant_id
- project_id nullable
- name
- workflow_type
- status: draft | published | archived
- active_version_id nullable
- created_by
- created_at
- updated_at

workflow_versions
- id
- workflow_definition_id
- version_number
- graph_json
- created_by
- created_at
- published_at nullable

workflow_runs
- id
- tenant_id
- project_id
- workflow_definition_id
- workflow_version_id
- subject_type
- subject_id
- status: running | waiting | completed | failed | cancelled
- started_at
- completed_at nullable

workflow_events
- id
- tenant_id
- project_id
- workflow_run_id
- node_key
- event_type
- payload_json
- created_at

The graph can initially be persisted as versioned JSON rather than normalized node/edge tables. Runtime events remain relational/auditable.

## 6. Multi-tenant rules

Every runtime record must carry tenant_id and project_id where applicable.
RLS must enforce tenant isolation.
Workflow definitions scoped to a project cannot be executed against another project.
Owner/platform access must not bypass customer isolation by default.
The browser/Rete graph is never a security boundary.

## 7. Execution rules

A published workflow version is immutable. Editing creates a new draft version.
A workflow run records the exact version used.
Action nodes must be idempotent where retries are possible.
Failures must create an auditable workflow event rather than silently skipping a node.
Manual overrides must identify user, timestamp, reason, previous state, and resulting state.

## 8. First planning workflow contract

Trigger: work package/activity enters the configured Lookahead horizon.

Readiness categories:
- space
- equipment
- labor
- materials
- information
- external

Decision:
- all required categories clear -> eligible for Weekly Planning
- any required category not clear -> action required

For each readiness answer of No, use the existing canonical Constraint Management behavior. Do not create a parallel workflow-only constraint model.

After a blocking constraint is resolved/cleared, readiness is evaluated again.

## 9. History and traceability

Workflow execution should contribute to Project History Log rather than create an unrelated audit trail. The desired trace is:

trigger -> evaluation -> blocker identified -> constraint created/linked -> owner/action -> resolution -> re-evaluation -> weekly-plan eligibility

This supports reconstructing why work did or did not become ready at a particular time.

## 10. Current prototype boundary

The current /workflow-lab implementation remains isolated and uses browser localStorage only.
It must not be treated as production persistence.
No production Supabase workflow tables should be created until the schema, RLS, service boundaries, and first workflow contract are reviewed.

## 11. Next implementation milestones

A. Inspect the existing Lookahead, readiness, Constraint Management, Weekly Planning, and Project History implementations.
B. Identify canonical services and direct table writes that need extraction/refactoring.
C. Define the workflow node registry and typed node contracts.
D. Design SQL schema and RLS policies without applying them.
E. Build a second isolated Workflow Lab scenario using the real planning vocabulary and mock data.
F. Review architecture and UX before any Supabase migration.
G. Only after approval, create migrations and connect one read-only real-data node first.
