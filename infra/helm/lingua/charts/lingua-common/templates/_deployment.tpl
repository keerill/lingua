{{/*
Deployment for one Lingua app. Notes:
- enableServiceLinks=false: kubelet's docker-link env vars (SVC_VOCABULARY_PORT=
  tcp://...) would shadow the app's own port variables.
- Prisma services run `prisma migrate deploy` in an initContainer using the
  shared migrator image; `migrate deploy` takes a DB advisory lock, so
  concurrent replicas are race-safe, and the pod just restarts with backoff
  until PostgreSQL is reachable.
*/}}
{{- define "lingua-common.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}
  labels:
    {{- include "lingua-common.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicas | default 1 }}
  selector:
    matchLabels:
      {{- include "lingua-common.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "lingua-common.selectorLabels" . | nindent 8 }}
    spec:
      enableServiceLinks: false
      {{- with .Values.global.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      securityContext:
        runAsNonRoot: true
        # Explicit numeric UID: our images declare USER by name (node=1000,
        # nginx-unprivileged=101), which kubelet cannot verify against
        # runAsNonRoot. node:24-slim "node" is uid 1000.
        runAsUser: {{ .Values.runAsUser | default 1000 }}
        seccompProfile:
          type: RuntimeDefault
      {{- if and .Values.migration .Values.migration.enabled }}
      initContainers:
        - name: migrate
          image: {{ include "lingua-common.migratorImage" . }}
          imagePullPolicy: {{ .Values.global.imagePullPolicy }}
          workingDir: /repo/apps/{{ .Chart.Name }}
          command: ["/repo/node_modules/.bin/prisma", "migrate", "deploy"]
          env:
            {{- include "lingua-common.env" . | nindent 12 }}
          securityContext:
            {{- include "lingua-common.containerSecurityContext" . | nindent 12 }}
      {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          image: {{ include "lingua-common.image" . }}
          imagePullPolicy: {{ .Values.global.imagePullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.port }}
            {{- if .Values.grpcPort }}
            - name: grpc
              containerPort: {{ .Values.grpcPort }}
            {{- end }}
          env:
            {{- include "lingua-common.env" . | nindent 12 }}
          readinessProbe:
            httpGet:
              path: {{ .Values.probePath | default "/health" }}
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: {{ .Values.probePath | default "/health" }}
              port: http
            initialDelaySeconds: 20
            periodSeconds: 20
          resources:
            {{- toYaml (.Values.resources | default (dict "requests" (dict "cpu" "50m" "memory" "128Mi") "limits" (dict "memory" "512Mi"))) | nindent 12 }}
          securityContext:
            {{- include "lingua-common.containerSecurityContext" . | nindent 12 }}
{{- end }}
