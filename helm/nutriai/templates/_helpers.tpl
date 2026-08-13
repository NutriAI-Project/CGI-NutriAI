{{/*
Common name helpers
*/}}
{{- define "nutriai.name" -}}
nutriai
{{- end -}}

{{- define "nutriai.serviceAccountName" -}}
{{- .Values.serviceAccount.name | default "nutriai-app-sa" -}}
{{- end -}}

{{/*
Standard labels applied to every resource.
*/}}
{{- define "nutriai.commonLabels" -}}
app.kubernetes.io/part-of: nutriai
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.global.environment }}
{{- end -}}

{{/*
Selector + object-meta labels for a single microservice, given ($ svcName svc)
Usage: {{ include "nutriai.svcLabels" (list $ $svcName $svc) }}
*/}}
{{- define "nutriai.svcLabels" -}}
{{- $root := index . 0 -}}
{{- $name := index . 1 -}}
{{- $svc := index . 2 -}}
app.kubernetes.io/name: {{ $name }}
app.kubernetes.io/part-of: nutriai
app.kubernetes.io/component: {{ $svc.tier }}
app.kubernetes.io/managed-by: {{ $root.Release.Service }}
environment: {{ $root.Values.global.environment }}
{{- end -}}

{{- define "nutriai.svcSelectorLabels" -}}
{{- $root := index . 0 -}}
{{- $name := index . 1 -}}
app.kubernetes.io/name: {{ $name }}
{{- end -}}

{{/*
Full image reference for a service: <registry>/<repository>:<tag>
*/}}
{{- define "nutriai.image" -}}
{{- $root := index . 0 -}}
{{- $svc := index . 1 -}}
{{- printf "%s/%s:%s" $root.Values.global.imageRegistry $svc.image.repository $svc.image.tag -}}
{{- end -}}

{{/*
DATABASE_URL built from the shared in-cluster postgres credentials.
*/}}
{{- define "nutriai.databaseUrl" -}}
{{- $root := . -}}
{{- printf "postgresql://%s:%s@postgres.%s.svc.cluster.local:5432/%s" $root.Values.postgres.credentials.username $root.Values.postgres.credentials.password $root.Values.global.namespace $root.Values.postgres.credentials.database -}}
{{- end -}}
