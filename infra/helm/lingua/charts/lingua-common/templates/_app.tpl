{{/*
The all-in-one entrypoint used by every app chart's templates/app.yaml:
  {{ include "lingua-common.app" . }}
*/}}
{{- define "lingua-common.app" -}}
{{ include "lingua-common.deployment" . }}
---
{{ include "lingua-common.service" . }}
{{- if and .Values.ingress .Values.ingress.enabled }}
---
{{ include "lingua-common.ingress" . }}
{{- end }}
{{- end }}
