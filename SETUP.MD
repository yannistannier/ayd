# Ask Your Document

## Setting up the frontend

### Bootstrapping the next app

Set up a new Next.js project called web

```bash
npx create-next-app@latest
```

Install the react-dsfr library

```bash
npm install @codegouvfr/react-dsfr
```

### Setting up react-dsfr

**Follow the section related to Next.js**

Install `sass` as a dev dependency:

```bash
npm install --save-dev sass
```

Install MUI and TSS React

```bash
npm install @mui/material @emotion/react @emotion/styled @emotion/server tss-react
```

Set up the next.config.js file to use the sass preprocessor

```js
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: config => {
        // We append a new rules to the existing webpack config specifying that all files with a .woff2 extension should be treated as a static asset resources
        config.module.rules.push({
            test: /\.woff2$/,
            type: "asset/resource"
        })
        return config
    }
}

export default nextConfig
```

Add pre-dev and pre-build scripts to the `package.json` file

```json
{
  "scripts": {
    "predev": "only-include-used-icons",
    "prebuild": "only-include-used-icons"
  }
}
```

Create the `app/defaultColorScheme.ts` file:

```ts
import type { DefaultColorScheme } from "@codegouvfr/react-dsfr/next-appdir";

export const defaultColorScheme: DefaultColorScheme = "system";
```

Create the `app/StartDsfr.tsx` file:

```tsx
// app/StartDsfr.tsx

"use client";

import { startReactDsfr } from "@codegouvfr/react-dsfr/next-appdir";
import { defaultColorScheme } from "./defaultColorScheme";
import Link from "next/link";

declare module "@codegouvfr/react-dsfr/next-appdir" {
    interface RegisterLink {
        Link: typeof Link;
    }
}

startReactDsfr({defaultColorScheme, Link});

export function StartDsfr() {
    //Yes, leave null here.
    return null;
}
```

Create the `app/layout.tsx` file:

```tsx
// app/layout.tsx

import { DsfrHead } from "@codegouvfr/react-dsfr/next-appdir/DsfrHead"
import { DsfrProvider } from "@codegouvfr/react-dsfr/next-appdir/DsfrProvider"
import { getHtmlAttributes } from "@codegouvfr/react-dsfr/next-appdir/getHtmlAttributes"
import { StartDsfr } from "./StartDsfr"
import { defaultColorScheme } from "./defaultColorScheme"

export default function RootLayout({children}: { children: JSX.Element; }) {
    const lang = "fr"

    return (
        <html {...getHtmlAttributes({defaultColorScheme})} >
        <head>
            <StartDsfr/>
            <DsfrHead
                // You can avoid having a flash of unstyled text by preloading the font variant used on your homepage
                preloadFonts={[
                    //"Marianne-Light",
                    //"Marianne-Light_Italic",
                    "Marianne-Regular",
                    //"Marianne-Regular_Italic",
                    "Marianne-Medium",
                    //"Marianne-Medium_Italic",
                    "Marianne-Bold",
                    //"Marianne-Bold_Italic",
                    //"Spectral-Regular",
                    //"Spectral-ExtraBold"
                ]}
            />
        </head>
        <body>
        <DsfrProvider lang={lang}>
            {children}
        </DsfrProvider>
        </body>
        </html>
    )
}
```

If you want to test the app quickly, you can create a simple page in `app/page.tsx`:

```tsx
// app/page.tsx

export default function HomePage() {
    return <h1>Hello World!</h1>
}
```

## Setting up the backend

### Creating a new virtual environment

Create a new directory that will host the backend code:

```bash
mkdir api
```

Create a new virtual environment and activate it:

```bash
cd api
pipenv install
pipenv shell
```

### Setting up fastapi

```bash
pipenv install fastapi
pipenv install "uvicorn[standard]"
```

Create a new file called `main.py`:

```python
# main.py

from typing import Union

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}
```

You can now run the server with the following command:

```bash
uvicorn app.main:app --reload
```

You can generate a `requirements.txt` file from your `Pipfile` one with the following command:

```bash
pipenv requirements > requirements.txt
```

### Required softwares

- node: https://nodejs.org/en/download/package-manager/current
- skaffold: https://skaffold.dev/docs/install/

### Replacing proxy env variables

Do not forget to set:

- HTTP_PROXY in ./api/pip.conf
- HTTP_PROXY in ./web/.npmrc

### Running the project

```bash
minikube start --driver docker --insecure-registry DOCKER_REGISTRY_URL --static-ip APP_STATIC_IP
minikube addons enable ingress
kubectl label nodes minikube size=large
skaffold dev
```

- Navigate to your static ip in your browser to view the project in action
- For now, the chat is accessible at `APP_STATIC_IP/chat`

### Classic issues

If your PersistentVolumeClaim terminating for a long time, you can patch it with the following command.

```bash
kubectl patch pvc {PVC_NAME} -p '{"metadata":{"finalizers":null}}'
```

https://blog.min.io/setting-up-a-development-machine-with-mlflow-and-minio/