# Deployment Spike: OpenAI Provider

This branch, `spike/restore-gpt-provider-for-deploy`, restores and adapts the older GPT/OpenAI scan path as an optional cloud AI provider for hosted client evaluation.

This is not a rollback, not a replacement for Ollama, and should not be merged automatically. It is a deployment/testing spike so the client can use a hosted Ligtas QC build over multiple days without keeping a local AI server running.

## Provider Options

The current local/private option remains Ollama. OpenAI is optional and controlled by environment variables. The deterministic rules engine remains available as the fallback path and can also be forced as the active scan mode.

```env
AI_PROVIDER=ollama
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
```

Supported `AI_PROVIDER` values:

- `ollama`: use local Ollama for AI-assisted scanning.
- `openai`: use the configured OpenAI model for AI-assisted scanning.
- `rules`: bypass AI and use deterministic rule checks.

The frontend upload flow can continue to request `scanMode=ai`. If `AI_PROVIDER=rules` or `AI_ENABLED=false`, the backend resolves that request to the rules path so hosted/demo configuration does not require frontend contract changes.

## PDF Extraction Options

This spike keeps the existing Node `pdf-parse` extraction as the default:

```env
PDF_EXTRACTOR_PROVIDER=pdf_parse
```

It also includes an optional PyMuPDF extraction path from the PDF extraction structure spike:

```env
PDF_EXTRACTOR_PROVIDER=pymupdf
PYMUPDF_PYTHON_BIN=python
PYMUPDF_EXTRACT_SCRIPT_PATH=scripts/pymupdf_extract.py
```

Install the optional Python dependency from the backend folder before using it:

```powershell
pip install -r requirements-pymupdf.txt
```

The default `pdf_parse` path was also adjusted to tolerate small vertical differences between text items, which avoids treating superscript ordinals such as `8th July 2022` as separate lines. The OpenAI prompt also tells the model to ignore extraction/layout artefacts and not report normal dates split by PDF text extraction.

## Privacy Note

When `AI_PROVIDER=openai`, extracted report text is sent to the configured OpenAI API provider. Real production use needs explicit client approval and appropriate organisational, contractual, data-processing, retention, and access-control arrangements. Do not use real client reports in this mode until those controls are agreed.

Original uploaded PDFs are still not stored permanently. The backend extracts report text for scanning and persists only normalized `Report` and `Issue` records used by QC Results, Report History, exports, review states, and analytics.

## Run With Ollama

Start Ollama and ensure the model is available:

```powershell
ollama serve
ollama pull llama3:8b-instruct-q4_0
```

Set backend environment:

```env
AI_PROVIDER=ollama
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:8b-instruct-q4_0
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_CHARS_PER_CHUNK=3000
```

Restart the backend after changing environment variables.

## Run With OpenAI

Set backend environment:

```env
AI_PROVIDER=openai
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
OPENAI_API_KEY=replace-with-deployment-secret
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TIMEOUT_MS=120000
OPENAI_MAX_CHARS_PER_CHUNK=12000
```

Store `OPENAI_API_KEY` only in the deployment secret store or local uncommitted `.env`. Do not commit real keys.

If OpenAI fails and `RULE_FALLBACK_ENABLED=true`, the backend logs the provider failure metadata and persists rule-based results instead. Set `RULE_FALLBACK_ENABLED=false` during validation if provider failures should be surfaced as upload errors.

## Hosted Demo Auth

For the hosted client demo, MFA can be disabled without deleting the MFA implementation:

```env
MFA_ENABLED=false
```

When omitted, MFA remains enabled by default and users with `mfaEnabled` plus `mfaSecret` on their account will still be asked for an authenticator code. This spike setting is intended only to reduce friction for demo/testing deployments.

## Force Rules Fallback

Use either of these configurations:

```env
AI_PROVIDER=rules
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
```

or:

```env
AI_ENABLED=false
RULE_FALLBACK_ENABLED=true
```

This keeps upload, QC Results, Report History, report detail, issue review states, CSV/PDF export, attached PDF review, annotated PDF export, admin analytics, team analytics, weekly digest, and role-based access on the existing persisted `Report` and `Issue` workflow.

## What Was Restored And Adapted

The old GPT/OpenAI implementation was found in Git commit `bd3d0bd1008dd7ffaf8b86dd50b164ba94550210` (`fixed ai and connected openai api`), primarily:

- `backend/src/services/analysis.service.ts`
- `backend/src/services/prompt.service.ts`
- `backend/src/config/ai.config.ts`
- `backend/src/utils/jsonParser.ts`

Reused ideas:

- OpenAI chat completions client setup.
- Strict allowed issue categories.
- JSON-only AI response contract.
- Confidence field support.
- Normalising unknown issue types to the current allowed issue enum.

Adapted for the current system:

- Provider adapter layer was added for `ollama` and `openai`.
- The current section chunking path remains in place and is configurable per provider.
- OpenAI output is mapped into the current normalized `Issue` persistence schema.
- Suggested action, evidence snippet, page number, section, severity, and confidence are accepted where present, while downstream workflows continue to read the existing persisted fields.
- The current database-backed report persistence path remains unchanged, so newer site functionality continues to use saved `Report` and `Issue` rows.

## Hosted Demo Deployment Steps

1. Deploy this spike branch only: `spike/restore-gpt-provider-for-deploy`.
2. Configure the normal app secrets: database URL, JWT secret, frontend origins, and email settings as needed.
3. Set `AI_PROVIDER=openai`, `AI_ENABLED=true`, and `RULE_FALLBACK_ENABLED=true`.
4. Add `OPENAI_API_KEY` through the host's secret manager.
5. Set `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, and `OPENAI_MAX_CHARS_PER_CHUNK` for the demo.
6. Run the backend and frontend build checks.
7. Upload a non-sensitive test PDF and confirm Upload -> scan -> QC Results.
8. Reopen the report from Report History and verify review states, exports, PDF review, analytics, and team analytics.
9. Confirm logs do not include API keys or full report text.
