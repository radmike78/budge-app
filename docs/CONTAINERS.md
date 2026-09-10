# Containers, Kubernetes and OpenShift

OnlyBudget is a phone app first. The iOS and Android builds are what most people
will use, and nothing in this document changes them. Containerizing is an
**option**: Expo compiles the same code to a web app, and this repo ships that
web build as an OCI image you can run with Podman or deploy to Kubernetes or
OpenShift, plus a builder image that produces the Android APK without Android
Studio.

Two things stay true in every form:

- **No backend.** The container is nginx serving static files. There is no
  database service, no API, no accounts. Data lives in the browser's own
  storage (SQLite compiled to WebAssembly, persisted per origin), exactly as it
  lives in SQLite on a phone. Backups and exports work the same way.
- **HTTPS is required in production.** The web build uses `SharedArrayBuffer`
  (for SQLite) and the microphone, which browsers only allow on secure,
  cross-origin-isolated pages. nginx sends the isolation headers; you supply
  TLS at the Ingress or Route. `http://localhost` is fine for local runs.

## 1. Podman (local)

```bash
# Build the web image (multi-stage: node builds, unprivileged nginx serves)
podman build -t onlybudget-web .

# Run it
podman run --rm -p 8080:8080 onlybudget-web
# open http://localhost:8080

# Or with compose
podman compose up --build
```

The image runs as a non-root user on port 8080, has a `/healthz` endpoint, and
works with a read-only root filesystem (`compose.yaml` runs it that way).

Push it to a registry your cluster can pull from:

```bash
podman tag onlybudget-web ghcr.io/<you>/onlybudget-web:1.0.0
podman login ghcr.io
podman push ghcr.io/<you>/onlybudget-web:1.0.0
```

`.github/workflows/container.yml` does the same automatically with Buildah on
every push to `main` (tag `edge`) and on `v*` tags (tag `latest` + the version),
publishing to `ghcr.io/<owner>/onlybudget-web`.

## 2. Kubernetes

Manifests live in `deploy/k8s` as Kustomize bases and overlays:

```
deploy/k8s/
  base/                 Deployment, Service, Ingress, NetworkPolicy, PodDisruptionBudget
  overlays/openshift/   swaps the Ingress for a Route
  overlays/production/  pins the image tag, 3 replicas, HPA
```

Deploy the base:

```bash
# 1. Point the Deployment at your image
sed -i 's|ghcr.io/radmike78/onlybudget-web:latest|ghcr.io/<you>/onlybudget-web:1.0.0|' deploy/k8s/base/deployment.yaml
# 2. Set your hostname in the Ingress
sed -i 's|budget.example.com|budget.your-domain.com|g' deploy/k8s/base/ingress.yaml
# 3. Apply
kubectl create namespace onlybudget
kubectl apply -k deploy/k8s/base -n onlybudget
kubectl rollout status deployment/onlybudget-web -n onlybudget
```

Notes:

- The Ingress assumes the nginx ingress controller (`ingressClassName: nginx`)
  and a TLS secret named `onlybudget-web-tls`. With cert-manager, uncomment the
  `cluster-issuer` annotation and it will be issued for you.
- The pod runs with `runAsNonRoot`, a read-only root filesystem, all
  capabilities dropped, no service-account token, and a NetworkPolicy that
  allows nothing outbound. That is correct: the app never calls anything.
- Resource requests are tiny (10m CPU, 32Mi) because it only serves files.

Production overlay (edit the tag in `overlays/production/kustomization.yaml`):

```bash
kubectl apply -k deploy/k8s/overlays/production -n onlybudget
```

Try it locally with kind or minikube:

```bash
kind create cluster
kind load docker-image onlybudget-web:latest   # or podman save | kind load image-archive
kubectl apply -k deploy/k8s/base
kubectl port-forward svc/onlybudget-web 8080:80
```

## 3. OpenShift

The image is built for OpenShift's restricted SCC: it does not require a fixed
UID, listens on 8080, and writes only to `/tmp` and `/var/cache/nginx`, which
the Deployment mounts as `emptyDir`.

**Option A: deploy the prebuilt image**

```bash
oc new-project onlybudget
oc apply -k deploy/k8s/overlays/openshift
oc get route onlybudget-web        # OpenShift assigns a host and edge TLS
```

The overlay removes the Ingress and adds a `Route` with edge TLS termination
and HTTP-to-HTTPS redirect, so the secure-context requirement is satisfied out
of the box. To use your own hostname, set `spec.host` in
`deploy/k8s/overlays/openshift/route.yaml`.

**Option B: let OpenShift build from source**

OpenShift can build the image itself from the `Containerfile` (Docker
strategy) so you never push an image manually:

```bash
oc new-project onlybudget
oc new-app https://github.com/<you>/budget-app --strategy=docker --name=onlybudget-web
oc create route edge onlybudget-web --service=onlybudget-web --port=8080-tcp --insecure-policy=Redirect
oc logs -f bc/onlybudget-web
```

For a private repository, add a source secret first
(`oc create secret generic github --from-literal=password=<token> --type=kubernetes.io/basic-auth`
and `oc set build-secret --source bc/onlybudget-web github`).

**Option C: Podman → internal registry**

```bash
oc registry login
podman tag onlybudget-web $(oc registry info)/onlybudget/onlybudget-web:1.0.0
podman push $(oc registry info)/onlybudget/onlybudget-web:1.0.0
oc apply -k deploy/k8s/overlays/openshift
oc set image deployment/onlybudget-web web=image-registry.openshift-image-registry.svc:5000/onlybudget/onlybudget-web:1.0.0
```

## 4. Building the Android APK in a container

`containers/android-builder/Containerfile` packages JDK 17, the Android SDK and
NDK, and Node, so the APK or AAB builds anywhere Podman runs. iOS cannot be
built in a Linux container; that still needs a Mac with Xcode (or a hosted
build service).

```bash
podman build -t onlybudget-android-builder -f containers/android-builder/Containerfile .

# Debug-signed release APK (add your keystore to android/ for store signing)
podman run --rm -v "$PWD:/src:Z" -v onlybudget-gradle:/root/.gradle onlybudget-android-builder apk
# → android/app/build/outputs/apk/release/

# Play Store bundle
podman run --rm -v "$PWD:/src:Z" -v onlybudget-gradle:/root/.gradle onlybudget-android-builder aab
```

The named volume keeps Gradle's cache between runs; the first build downloads
a lot, later ones are quick. The `android/` folder it generates is git-ignored.

## 5. What is and isn't verified

- The web export (`npm run build:web`), the PWA post-build step, and the Metro
  configuration for the SQLite wasm asset were run and checked in this repo.
- The Kubernetes and OpenShift YAML parses and follows current API versions,
  but has not been applied to a live cluster from this environment.
- The `Containerfile` and the Android builder image were written against the
  documented base images but not built here (no container daemon in the
  authoring environment). Expect the first `podman build` to be the real test.
- Voice on the web depends on the browser's Web Speech API (Chrome and Edge
  yes, Safari partially, Firefox no). Typing always works.
