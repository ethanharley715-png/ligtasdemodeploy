# AI Provider Switching Guide

This guide explains what can be changed in the current handover build and what would need extra implementation work.

The current AI-assisted scan path uses a local Ollama service. Changing to another Ollama-compatible local model is mainly a configuration change. Switching to a cloud AI provider is possible, but it is not currently a configuration-only switch.

## Current Implementation

The live AI-assisted scanning flow is:

```text
PDF upload or session analysis
-> runAnalysis
-> analyzeSections
-> callOllama
-> parse and normalize issues
-> persist report results
```

The main files are:

- `backend/src/services/reportSessionService.ts`
- `backend/src/services/reportAnalysisService.ts`
- `backend/src/services/analysis.service.ts`
- `backend/src/ai/analyser.ts`
- `backend/src/ai/parser.ts`
- `backend/src/ai/ollamaClient.ts`
- `backend/src/ai/promptBuilder.ts`
- `backend/src/config/scanConfig.ts`
- `backend/.env.example`

The current provider-specific code is in `backend/src/ai/ollamaClient.ts`. It sends prompts to:

```text
<OLLAMA_BASE_URL>/api/generate
```

The model name is read from:

```env
OLLAMA_MODEL
```

The base URL is read from:

```env
OLLAMA_BASE_URL
```

If these variables are not set, the backend defaults to:

```env
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3:8b-instruct-q4_0"
```

## Switching To Another Local Ollama Model

This is the supported switching path in the current codebase.

### 1. Install And Start Ollama

Install Ollama, then start the local service:

```powershell
ollama serve
```

The default service URL is:

```text
http://127.0.0.1:11434
```

### 2. Pull The Target Model

Pull the model the client wants to use:

```powershell
ollama pull <model-name>
```

Example:

```powershell
ollama pull llama3.1:8b
```

Check that the model is available:

```powershell
ollama list
```

### 3. Update Backend Environment Variables

Update `backend/.env`:

```env
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="<model-name>"
```

Example:

```env
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3.1:8b"
```

### 4. Restart The Backend

After changing environment variables, restart the backend so the new values are loaded.

From the backend folder:

```powershell
npm run dev
```

### 5. Validate The Scan Output

Upload a report through the application and confirm that:

- the upload completes successfully
- the AI scan returns issues in the expected categories
- generated output is valid JSON
- issue locations still map sensibly to report sections or pages
- rule-based scanning remains available as a fallback

Different local models may produce different JSON formatting or less consistent issue descriptions. The prompt asks for strict JSON, but model behaviour still needs to be tested after any model change.

## Switching To A Larger Local Model

The process is the same as switching to another Ollama model:

1. Pull the larger model with `ollama pull`.
2. Set `OLLAMA_MODEL` to the larger model name.
3. Restart the backend.
4. Re-test AI-assisted scanning.

Before using a larger model, check:

- available RAM and VRAM
- expected scan latency
- whether the model can reliably follow the required JSON schema
- whether backend timeouts or frontend progress expectations need adjustment

Larger models may improve output quality, but they can also increase processing time and hardware requirements.

## Switching To Rule-Based Scanning

The application also includes deterministic rule-based scanning.

To disable AI-assisted scans and use the rule-based path:

```env
AI_ENABLED=false
RULE_FALLBACK_ENABLED=true
```

Restart the backend after changing these values.

This is useful if the local AI service is unavailable or if the client wants a more predictable non-AI fallback.

## Switching To A Cloud AI Provider

Cloud AI support is a future integration path. The current report scanning path imports the Ollama client directly, so moving to a cloud provider requires code changes.

Examples of possible cloud providers include:

- OpenAI
- Azure OpenAI
- Anthropic
- AWS Bedrock
- Google Vertex AI

The backend already has an OpenAI client in `backend/src/config/ai.config.ts`, but that is currently used by the embedding experiment path, not by the main report scanning path.

### Recommended Implementation Approach

Add a provider-neutral interface first:

```ts
export interface AiTextProvider {
  generate(prompt: string): Promise<string>;
}
```

Then create provider implementations such as:

```text
backend/src/ai/providers/ollamaProvider.ts
backend/src/ai/providers/openAiProvider.ts
backend/src/ai/providers/index.ts
```

The Ollama provider would wrap the current `callOllama` behaviour.

The cloud provider would call the selected cloud model and return plain text containing the model response.

### Suggested Environment Variables

Add provider selection through environment variables:

```env
AI_PROVIDER="ollama"
AI_MODEL="llama3:8b-instruct-q4_0"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
```

For OpenAI, an example shape could be:

```env
AI_PROVIDER="openai"
OPENAI_API_KEY="replace-with-client-key"
AI_MODEL="replace-with-approved-model"
```

Do not commit real API keys.

### Files To Update

At minimum, update:

- `backend/src/ai/analyser.ts`
- `backend/src/ai/parser.ts`
- `backend/src/ai/ollamaClient.ts` or a new provider wrapper
- `backend/src/config/ai.config.ts` or a new AI provider config file
- `backend/.env.example`
- AI provider tests under `backend/src/ai/tests`

The key change is that `analyser.ts` and `parser.ts` should call the provider-neutral interface instead of importing `callOllama` directly.

### Validation Required For Cloud Providers

Before enabling a cloud model for client use, validate:

- uploaded report content is allowed to be sent to the provider
- client data protection and retention requirements
- API key storage and rotation
- request cost and usage limits
- latency and timeout behaviour
- error handling when the provider is unavailable
- JSON output reliability
- compatibility with the current issue schema
- fallback behaviour when AI scanning fails

## Required Output Shape

Any provider must return content that can be parsed into this shape:

```json
{
  "issues": [
    {
      "type": "TEMPLATE_ARTIFACT",
      "description": "Found placeholder XX",
      "section": "5.7",
      "quote": "XX"
    }
  ]
}
```

Allowed issue types are:

- `TEMPLATE_ARTIFACT`
- `UNREMOVED_GUIDANCE`
- `MISSING_INFORMATION`
- `CONTRADICTION`
- `LIMITATION_CONTRADICTION`
- `INCOMPLETE_LIMITATIONS`

If no issues are found, the provider should return:

```json
{ "issues": [] }
```

## Handover Summary

Recommended wording for handover:

> The AI-assisted scanning is currently configured around a local Ollama model. The local model can be changed through environment configuration, provided the replacement model is available in Ollama and is validated against the expected JSON output. Cloud AI support can be added in future, but it requires a provider adapter, configuration updates, and testing rather than being a simple environment-variable switch.

