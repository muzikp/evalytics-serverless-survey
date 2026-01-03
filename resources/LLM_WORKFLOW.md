# LLM_WORKFLOW (Claude Sonnet / jiné)

Cíl: udržet konzistentní vývoj a minimalizovat „LLM drift“.

## Základní pravidla
1) **API kontrakt je vždy `docs/openapi.yaml`** (single source of truth).
2) Než se sahá do implementace, aktualizuj OpenAPI.
3) Po změně backendu aktualizuj UI integraci a testy.
4) Každý PR musí projít: build UI + validate/build SAM.

## Doporučený postup pro změnu
- PLAN: co se mění, jaké endpointy, jaké DB změny
- OPENAPI: uprav `docs/openapi.yaml`
- DB: uprav `/utils/sql/` (nová migrace)
- API: implementuj handlers + auth + validace
- UI: napojení, error states, i18n texty
- TEST: unit/integration (aspoň smoke)
- DOC: aktualizuj `docs/SPEC.md` pokud se změnil koncept

## Checklist (před merge)
- [ ] OpenAPI validní (YAML + schemas)
- [ ] DB migrace má forward-only cestu
- [ ] Public token se neukládá v plaintextu
- [ ] Uploady jdou přes S3 (ne přes API Gateway)
- [ ] Email sending je async (SQS worker)
