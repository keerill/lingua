{{- define "lingua-common.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .Chart.Name }}
  labels:
    {{- include "lingua-common.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    {{- include "lingua-common.selectorLabels" . | nindent 4 }}
  ports:
    - name: http
      port: {{ .Values.port }}
      targetPort: http
    {{- if .Values.grpcPort }}
    - name: grpc
      port: {{ .Values.grpcPort }}
      targetPort: grpc
    {{- end }}
{{- end }}
