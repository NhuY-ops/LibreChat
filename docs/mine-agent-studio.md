# MINE Agent Studio — implementation & feature roadmap

## What already exists in the LibreChat Agent editor

- Avatar, name, description, provider/model, category
- Inline instructions or instructions linked to a saved prompt
- Tool catalog, MCP connections, actions and built-in capabilities
- Skills Off / All / Selected (subject to permissions/config)
- Agent file context (uploads require saving the Agent first)
- Conversation starters, support contact, advanced parameters
- Create/update, version controls, duplicate, permissions/sharing where authorized
- Select an existing Agent to use it in Chat

Do not copy these fields into a separate UI mock or fork their persistence
logic. They are part of the real existing editor.

## Agent Studio V1 (this change)

- **Quick start templates**: Personal, Research, Marketing, Coding, Learning.
  Selecting a template fills existing form fields only: name, description,
  inline instructions, conversation starters. It does not change the model,
  provider, credentials, category, tools or skills.
- **Draft safety**: If a user already entered identity, instructions, or
  conversation starters, show an explicit confirmation before overwriting.
  Apply only on user action; never auto-fill on panel mount.
- **Setup guide**: Explicit 3-point progress display (name, model/provider,
  inline or linked instructions). It is a form guide, not proof that a model
  API key is valid or tools are accessible.
- **Skill scope explanation**: Off = no skills; All = all permitted skills,
  including subsequently available skills; Selected = only chosen skills.
- **Use in Chat**: Rename existing Agent-selection action, without changing its
  backend behavior.
- New quick start and progress UI show only during Agent creation, not editing.

## How to try locally

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd client
npm run typecheck
```

In MINE > Agents > Create New Agent:
1. Choose Research template and verify name, description, instructions, starters.
2. Verify the current model and chosen tools did NOT change.
3. Click another template; confirm MINE asks before replacing the current draft.
4. Choose Keep my work, then Replace draft; verify both paths.
5. Fill missing model/provider as needed and verify 3/3 setup basics.
6. Click Create. If successful, verify File Context is now available.
7. Use the saved Agent's **Use in Chat** button; actual model calls require
   working provider/model credentials and permitted tools.

Suggested tests (if Jest dependencies are installed):

```bash
cd ~/mine-ai
npx jest client/src/components/SidePanel/Agents/mineAgentTemplates.test.ts \
  client/src/components/SidePanel/Agents/MineAgentQuickStart.test.tsx \
  --runInBand
```

## Next versions (not built yet)

- **V2 Agent Playground**: test a draft Agent with an explicit ephemeral
  sandbox request, track response time/cost/tool calls, and compare revisions.
  Never pretend a visual preview executes a model.
- **V3 Agent Knowledge**: multi-file collections with citation-based retrieval,
  refresh/re-indexing controls and scoped project/team permissions.
- **V4 Agent Workflow Studio**: graphical workflow builder, typed tool
  permissions, user approvals, human handoff, run trace, replay and debugging.
- **Enterprise Agent Ops**: organizations/departments, role-based access, budget
  limits, evaluation suites, deployment approvals, logging and version
  lifecycle. Keep tenancy isolated from the start.

Avoid arbitrary claims about the availability of a named model such as
`gpt-6-astra`: model catalog entries are not evidence that provider keys,
usage rights, or endpoint runtimes are configured.
