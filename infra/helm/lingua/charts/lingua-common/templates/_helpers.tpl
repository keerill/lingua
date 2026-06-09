{{/*
Shared helpers for all Lingua app charts. Chart name == k8s Service name ==
in-cluster DNS name (e.g. http://svc-content:3106), single-release umbrella.
*/}}

{{- define "lingua-common.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/part-of: lingua
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "lingua-common.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
{{- end }}

{{- define "lingua-common.image" -}}
{{- printf "%s/%s:%s" .Values.global.imageRegistry .Values.image.repository (.Values.image.tag | default .Values.global.imageTag) -}}
{{- end }}

{{- define "lingua-common.migratorImage" -}}
{{- printf "%s/lingua/migrator:%s" .Values.global.imageRegistry .Values.global.imageTag -}}
{{- end }}

{{- define "lingua-common.host" -}}
{{- printf "%s.%s" .Values.ingress.subdomain .Values.global.domain -}}
{{- end }}

{{/*
Container env: plain values from .Values.env (rendered through tpl so charts
can reference e.g. {{ .Values.global.domain }}), secret-backed names from
.Values.secretEnv (keys of the shared lingua-secrets Secret).
*/}}
{{- define "lingua-common.env" -}}
{{- range $name, $value := .Values.env }}
- name: {{ $name }}
  value: {{ tpl (toString $value) $ | quote }}
{{- end }}
{{- range .Values.secretEnv }}
- name: {{ . }}
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.global.secretName }}
      key: {{ . }}
{{- end }}
{{- if .Values.global.observability.enabled }}
{{- /* one place wires OTel into every app. The register module
       (@lingua/observability/register) starts the SDK only when the endpoint
       is set, and the service name is the chart name. */}}
- name: OTEL_SERVICE_NAME
  value: {{ .Chart.Name }}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.global.observability.otlpEndpoint | quote }}
- name: OTEL_EXPORTER_OTLP_PROTOCOL
  value: http/protobuf
{{- end }}
{{- if and .Values.global.schemaRegistry .Values.global.schemaRegistry.enabled }}
{{- /* with the registry URL present, Kafka events are Protobuf-encoded
       through the Schema Registry (resolveSerde opt-in); unset → JSON. One place
       wires it into every app, same as the OTel block above. */}}
- name: SCHEMA_REGISTRY_URL
  value: {{ .Values.global.schemaRegistry.url | quote }}
{{- if and .Values.global.schemaRegistry.auth .Values.global.schemaRegistry.auth.enabled }}
{{- /* basic auth for a managed registry (e.g. DO Karapace). */}}
- name: SCHEMA_REGISTRY_USER
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.global.secretName }}
      key: SCHEMA_REGISTRY_USER
- name: SCHEMA_REGISTRY_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.global.secretName }}
      key: SCHEMA_REGISTRY_PASSWORD
{{- end }}
{{- end }}
{{- if and .Values.global.kafkaAuth .Values.global.kafkaAuth.enabled }}
{{- /* managed Kafka (SASL_SSL). libs/kafka's createKafka reads these
       env vars (opt-in); unset → PLAINTEXT for k3d/compose/tests. */}}
- name: KAFKA_SSL
  value: "true"
- name: KAFKA_SSL_CA
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.global.secretName }}
      key: KAFKA_SSL_CA
- name: KAFKA_SASL_USERNAME
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.global.secretName }}
      key: KAFKA_SASL_USERNAME
- name: KAFKA_SASL_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.global.secretName }}
      key: KAFKA_SASL_PASSWORD
{{- end }}
{{- end }}

{{- define "lingua-common.containerSecurityContext" -}}
allowPrivilegeEscalation: false
capabilities:
  drop: ["ALL"]
{{- end }}
