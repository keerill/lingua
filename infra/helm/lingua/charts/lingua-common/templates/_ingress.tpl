{{- define "lingua-common.ingress" -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Chart.Name }}
  labels:
    {{- include "lingua-common.labels" . | nindent 4 }}
spec:
  ingressClassName: {{ .Values.global.ingressClassName }}
  rules:
    - host: {{ include "lingua-common.host" . }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Chart.Name }}
                port:
                  name: http
{{- end }}
