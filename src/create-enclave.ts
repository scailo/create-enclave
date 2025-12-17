#!/usr/bin/env node

import fs = require("fs");
import path = require("path");
import child_process = require("child_process");
import ts = require('typescript');
import prompt = require('@inquirer/prompts');

let applicationIdentifier = "scailo-test-widget";
let applicationName = "Scailo Test Widget";

let version = "0.0.1";
const rootFolder = path.dirname(__dirname);

type enclaveTemplateType = "node" | "golang" | "python";

let selectedEnclaveTemplate: enclaveTemplateType = "node";

async function acceptUserInputs() {
    applicationName = (await prompt.input({
        message: "Enter the Application Name: ",
        default: applicationName,
        required: true,
        validate: input => input.length > 0
    })).trim();

    applicationIdentifier = (await prompt.input({
        message: "Enter the Application Identifier: ",
        default: applicationIdentifier,
        required: true,
        validate: input => input.length > 0
    })).trim();

    version = (await prompt.input({
        message: "Enter the Initial Version Number (Semver Format): ",
        default: version,
        required: true,
        validate: input => input.length > 0
    })).trim();

    selectedEnclaveTemplate = (await prompt.select({
        message: "Select the Enclave Template",
        choices: [
            { name: "Node", value: "node", description: "Create a Node based Enclave" },
            { name: "Golang", value: "golang", description: "Create a Golang based Enclave" },
            { name: "Python", value: "python", description: "Create a Python based Enclave" },
        ], default: ""
    })).trim() as enclaveTemplateType;

    console.log(`Application Name: ${applicationName}`);
    console.log(`Application Identifier: ${applicationIdentifier}`);
    console.log(`Version: ${version}`);
    console.log(`Enclave Template: ${selectedEnclaveTemplate}`);
}

function spawnChildProcess(command: string, args: string[] = [], options = {}) {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn(command, args, { ...options, shell: process.platform === "win32" ? true : undefined });

        // Optional: Log stdout and stderr for debugging
        child.stdout.on('data', (data) => {
            console.log(`${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(`Child process exited with code ${code}`);
            } else {
                reject(new Error(`Child process exited with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

async function setupGitIgnore() {
    // Setup the .gitignore file
    const gitignoreList = [
        "node_modules/",
        ".env",
        "tsconfig.tsbuildinfo",
        ".DS_Store"
    ];

    fs.writeFileSync(".gitignore", gitignoreList.join("\n").trim(), { flag: "w", flush: true });
}

async function setupCommonNPMDependencies() {
    // Setup the node modules installation
    const npmDependencies = [
        "@kernelminds/scailo-sdk@latest",
        "@bufbuild/protobuf@1.10.0",
        "@connectrpc/connect-web@1.7.0",
        "path-to-regexp@6.1.0"
    ];

    await spawnChildProcess("npm", ["install", ...npmDependencies, "--save"]);

    const npmDevDependencies = [
        "tailwindcss",
        "@tailwindcss/cli",
        "daisyui@latest",
        "esbuild",
        "@inquirer/prompts@7.8.6",
        "concurrently@9.2.1",
        "semver",
        "@types/semver",
        "yaml",
        "adm-zip",
        "@types/adm-zip",
        "typescript",
        "@types/node",
    ];

    await spawnChildProcess("npm", ["install", ...npmDevDependencies, "--save-dev"]);
}

async function setupDependencies({ enclaveType }: { enclaveType: enclaveTemplateType }) {
    if (enclaveType == "node") {
        await setupDependenciesForNode();
    } else if (enclaveType == "golang") {
        await setupDependenciesForGolang();
    } else if (enclaveType == "python") {
        await setupDependenciesForPython();
    }

    // Create the tsconfig.json
    await spawnChildProcess("npx", ["tsc", "--init"]);
}

async function setupDependenciesForNode() {
    await setupCommonNPMDependencies();

    const npmDependencies = [
        "@connectrpc/connect-node@1.7.0",
        "fastify@4.28.1",
        "@fastify/static@7.0.4",
        "fastify-favicon@4.3.0",
        "dotenv",
    ]

    await spawnChildProcess("npm", ["install", ...npmDependencies, "--save"]);
}

async function setupDependenciesForGolang() {
    await setupCommonNPMDependencies();
}

async function setupDependenciesForPython() {
    await setupCommonNPMDependencies();
}

async function setupScripts() {
    const scriptsFolderName = path.join("scripts")
    let folders = [
        path.join(scriptsFolderName),
    ];
    for (const folder of folders) {
        fs.mkdirSync(folder, { recursive: true });
    }
    // Copy package.ts
    fs.copyFileSync(path.join(rootFolder, "src", "package.ts"), path.join(scriptsFolderName, "package.ts"));
}

function createResourcesFolders() {
    const resourcesFolderName = path.join("resources");
    const distFolderName = path.join(resourcesFolderName, "dist");
    const srcFoldername = path.join(resourcesFolderName, "src");
    let resourcesFolders = [
        path.join(resourcesFolderName),

        path.join(distFolderName),
        path.join(distFolderName, "css"),
        path.join(distFolderName, "img"),
        path.join(distFolderName, "js"),

        path.join(srcFoldername),
        path.join(srcFoldername, "ts"),
        path.join(srcFoldername, "css")
    ];

    for (const folder of resourcesFolders) {
        fs.mkdirSync(folder, { recursive: true });
    }

    const appCSSPath = path.join(srcFoldername, "css", "app.css");
    const appEntryTSPath = path.join(srcFoldername, "ts", "app.ts");
    const routerEntryTSPath = path.join(srcFoldername, "ts", "router.ts");
    // Copy the img folder
    fs.cpSync(path.join(rootFolder, "img"), path.join(distFolderName, "img"), { recursive: true });

    return {
        appCSSPath,
        distFolderName,
        appEntryTSPath,
        routerEntryTSPath
    }
}

async function createBuildScripts({ appCSSPath, distFolderName, appEntryTSPath, enclaveType }: { appCSSPath: string, distFolderName: string, appEntryTSPath: string, enclaveType: enclaveTemplateType }) {
    // Write all the package JSON scripts here
    let packageJSON = JSON.parse(fs.readFileSync("package.json", "utf-8")) as Object;
    let packageJSONScripts = (<any>packageJSON).scripts || {} as Object;

    let scripts = [
        ["css:build", `npx tailwindcss -i ${appCSSPath} -o ${path.join(distFolderName, "css", "bundle.css")} --minify`],
        ["css:watch", `npx tailwindcss -i ${appCSSPath} -o ${path.join(distFolderName, "css", "bundle.css")} --watch`],

        ["ui:build", `npx esbuild ${appEntryTSPath} --bundle --outfile=${path.join(distFolderName, "js", "bundle.src.min.js")} --minify`],
        ["ui:watch", `npx esbuild ${appEntryTSPath} --bundle --outfile=${path.join(distFolderName, "js", "bundle.src.min.js")} --watch`],

        ["dev:watch", `npx concurrently "npm run ui:watch" "npm run css:watch"`],

        ["package", `npx tsx scripts/package.ts`],
    ]

    if (enclaveType == "node") {
        scripts.push(["dev:start", `npx tsx -r dotenv/config server.ts`]);
        scripts.push(["start", `npx tsx server.ts`]); // This is in production
    } else if (enclaveType == "golang") {
        scripts.push(["dev:start", `go run server.go`]);
        scripts.push(["start", `go run server.go`]); // This is in production
    } else if (enclaveType == "python") {
        scripts.push(["dev:start", `uv run server.py`]);
        scripts.push(["start", `uv run server.py`]); // This is in production
    }

    for (let i = 0; i < scripts.length; i++) {
        let script = scripts[i]!;
        packageJSONScripts[script[0]!] = script[1];
    }

    (<any>packageJSON).scripts = packageJSONScripts;
    (<any>packageJSON).version = version;
    fs.writeFileSync("package.json", JSON.stringify(packageJSON, null, 2), { flag: "w", flush: true });
}

async function createIndexHTML({ appName, version, enclaveName }: { appName: string, version: string, enclaveName: string }) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="/enclave/${enclaveName}/resources/dist/img/favicon.ico" type="image/x-icon">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <link rel="preload" as="script" href="/enclave/${enclaveName}/resources/dist/js/bundle.src.min.js">
    <link rel="stylesheet" href="/enclave/${enclaveName}/resources/dist/css/bundle.css">
    <title>${appName}</title>
</head>
<body class="text-gray-800">
    <div class="container text-center">
        <h1 class="text-3xl font-bold">${appName}</h1>
    </div>
    <div id="container" class="container"></div>
    <!-- Attach the JS bundle here -->
    <script src="/enclave/${enclaveName}/resources/dist/js/bundle.src.min.js"></script>
</body>
</html>
`;

    // Create index.html
    fs.writeFileSync("index.html", html.trim(), { flag: "w", flush: true });
}

async function createEntryTS({ appEntryTSPath, enclaveName }: { appEntryTSPath: string, enclaveName: string }) {
    const script = `
import { createConnectTransport } from "@connectrpc/connect-web";
import { Router } from "./router";

export const enclaveName = "${enclaveName}";

/**
 * Message handler type for Scailo widget. Receives messages from the parent application
 */
export type ScailoWidgetMessage = {
    type: "refresh",
    payload: any
};

/**
 * Message handler for Scailo widget
 */
window.addEventListener("message", (evt: MessageEvent<ScailoWidgetMessage>) => {
    if (evt.data.type == "refresh") {
        location.reload();
    }
});

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Starts the router  */
function startRouter() {
    let r = new Router();
    const routePrefix = \`/enclave/\${enclaveName}\`;
    r.add(\`\${routePrefix}/ui\`, async (ctx) => {
        const container = document.getElementById("container") as HTMLDivElement;
        while (true) {
            await wait(1000);
            let payload = await (await fetch(\`\${routePrefix}/api/random\`, { method: "GET", headers: { "Content-Type": "application/json" } })).json() as { random: number };
            container.innerHTML = payload.random.toString();
        }
    });

    r.add(\`\${routePrefix}/404\`, async (ctx) => {
        handlePageNotFound(ctx);
    });

    r.setDefault((ctx) => {
        location.href = \`\${routePrefix}/ui\`;
    });

    r.start();
}

/** Handles page not found */
function handlePageNotFound(ctx: any) {
    let content = <HTMLDivElement>document.getElementById("container");
    content.innerHTML = "Invalid page";
}

window.addEventListener("load", async (evt) => {
    evt.preventDefault();
    startRouter();
});

export function getReadTransport() {
    return createConnectTransport({
        // Need to use binary format (at least for the time being)
        baseUrl: location.origin, useBinaryFormat: false, interceptors: []
    });
}
`;

    // Create index.ts
    fs.writeFileSync(appEntryTSPath, script.trim(), { flag: "w", flush: true });
}

async function createRouterTS({ routerEntryTSPath }: { routerEntryTSPath: string }) {
    const script = `

import { match, MatchFunction } from "path-to-regexp";

/**Stores the relationship between the path and the provided callback */
interface relation {
    path: MatchFunction<object> | null
    callback: (ctx: context) => void
}

/**Class that performs the routing */
export class Router {
    relationships: relation[]
    defaultRelation: relation

    constructor() {
        this.relationships = [];
        this.defaultRelation = <relation>{};
    }

    /**Adds a path along with the callback to the router */
    add(path: string, callback: (ctx: context) => void) {
        let r = <relation>{
            path: match(path),
            callback: callback
        };
        this.relationships.push(r);
    }

    setDefault(callback: (ctx: context) => void) {
        this.defaultRelation = {
            path: null,
            callback: callback
        }
    }

    /**Navigates the user to the provided href */
    private _navigate(href: string, searchParams: string) {
        if (!href.startsWith("tel")) {
            history.pushState({ href: href, searchParams: searchParams }, "", href + searchParams);
            this.traverseRelationships(href, searchParams);
        }
    }

    private traverseRelationships(href: string, searchParams: string) {
        for (let i = 0; i < this.relationships.length; i++) {
            let t = this.relationships[i];
            let match = t.path!(href);
            if (match) {
                let c = <context>{
                    querystring: searchParams,
                    pathname: href,
                    path: href + searchParams,
                    params: match.params
                }
                t.callback(c);
                return
            }
        }
        this.defaultRelation.callback({
            querystring: location.search,
            pathname: location.pathname,
            path: location.pathname + location.search,
            params: null
        });
    }

    _handleAnchorTag(t: HTMLAnchorElement, e: MouseEvent) {
        if (t.getAttribute("download") != null || t.getAttribute("target") != null || t.getAttribute("href") == null) {
            return true
        } else {
            // Prevent default only in the case where the default functionality of the link is being overridden
            e.preventDefault();
            let tempHref = t.href.replace(location.origin, "");
            let split = tempHref.split("?");
            let href = "";
            let searchParams = "";
            if (split.length == 1) {
                href = split[0];
            } else {
                href = split[0];
                searchParams = "?" + split[1];
            }
            this._navigate(href, searchParams);
        }
    }

    /**Starts the router */
    start() {
        let localThis = this;
        document.addEventListener("click", e => {
            if (e.ctrlKey || e.metaKey) {
                // If control key or any other modifier key has been clicked, do not handle it wih this library
                return true
            }
            let el = <HTMLElement>e.target;
            if (el.nodeName.toLowerCase() == "a") {
                this._handleAnchorTag(<HTMLAnchorElement>el, e);
            } else if (el.nodeName.toLowerCase() == "button") {
                return true
            } else {
                let parentAnchor: HTMLAnchorElement | null = null;
                let parentEl = el.parentElement;
                if (parentEl == null) {
                    return true
                }
                while (parentEl != null) {
                    if (parentEl.nodeName.toLowerCase() == "body") {
                        break
                    }
                    if (parentEl.nodeName.toLowerCase() == "a") {
                        parentAnchor = <HTMLAnchorElement>parentEl;
                        break
                    }
                    parentEl = parentEl.parentElement;
                }
                if (parentAnchor == null) {
                    return true
                }
                // Handle click of the parent element here
                this._handleAnchorTag(parentAnchor, e);
            }
        });

        window.addEventListener("popstate", function (e) {
            e.preventDefault();
            localThis.traverseRelationships(location.pathname, location.search)
        });

        /**Create the global function to route to a certain URL */
        (<any>window).routeTo = function (url: string) {
            let t = new URL(location.origin + url);
            localThis._navigate(t.pathname, t.search);
        }

        this._navigate(location.pathname, location.search);
    }
}

/**Stores the router parameters */
export interface context {
    querystring: string
    /**Is the object that consists of the matched parameters */
    params: any
    /**The pathname void of query string "/login" */
    pathname: string
    /**Pathname and query string "/login?foo=bar" */
    path: string
}
    
`;
    // Create router.ts
    fs.writeFileSync(routerEntryTSPath, script.trim(), { flag: "w", flush: true });
}

async function createManifest({ appName, version, enclaveName, appIdentifier, enclaveType }: { appName: string, version: string, enclaveName: string, appIdentifier: string, enclaveType: enclaveTemplateType }) {
    let startExec = "";
    if (enclaveType == "node") {
        startExec = `npm start`;
    } else if (enclaveType == "golang") {
        startExec = `go run server.go`;
    } else if (enclaveType == "python") {
        startExec = `uv run server.py`;
    }
    let manifest = `
manifest_version: 1
enclave_type: ${enclaveType}
app_version: ${version}
app_name: ${appName}
enclave_name: ${enclaveName}
app_unique_identifier: "${appIdentifier}"
start_exec: "${startExec}"
resources:
    logos:
        - resources/dist/img/logo.png
    folders: []`;

    if (enclaveType == "node") {
        manifest += `
    files:
        - index.html
        - server.ts
    `
    } else if (enclaveType == "golang") {
        manifest += `
    files:
        - index.html
        - server.go
        - go.mod
        - go.sum
    `
    } else if (enclaveType == "python") {
        manifest += `
    files:
        - index.html
        - server.py
        - pyproject.toml
        - uv.lock
        - .python-version
    `
    }

    // Create MANIFEST.yaml
    fs.writeFileSync("MANIFEST.yaml", manifest.trim(), { flag: "w", flush: true });
}

async function createTestServer({ enclaveType, enclaveName }: { enclaveType: enclaveTemplateType, enclaveName: string }) {
    if (enclaveType == "node") {
        fs.copyFileSync(path.join(rootFolder, "server", "node", "server.ts"), "server.ts");
    } else if (enclaveType == "golang") {
        fs.copyFileSync(path.join(rootFolder, "server", "golang", "server.go"), "server.go");
        fs.copyFileSync(path.join(rootFolder, "server", "golang", "go.mod"), "go.mod");
        fs.copyFileSync(path.join(rootFolder, "server", "golang", "go.sum"), "go.sum");
    } else if (enclaveType == "python") {
        fs.copyFileSync(path.join(rootFolder, "server", "python", "server.py"), "server.py");
        fs.copyFileSync(path.join(rootFolder, "server", "python", "pyproject.toml"), "pyproject.toml");
        fs.copyFileSync(path.join(rootFolder, "server", "python", "uv.lock"), "uv.lock");
        fs.copyFileSync(path.join(rootFolder, "server", "python", ".python-version"), ".python-version");
    }

    const envFile = `
ENCLAVE_NAME=${enclaveName}
SCAILO_API=http://127.0.0.1:21000
PORT=9090
PRODUCTION=false
USERNAME=
PASSWORD=`;

    fs.writeFileSync(".env", envFile.trim(), { flag: "w", flush: true });
}

async function fixTSConfig() {
    const configFileName = ts.findConfigFile(
        "tsconfig.json",
        ts.sys.fileExists,
    );

    if (!configFileName) {
        throw new Error(`Could not find a valid tsconfig.json`);
    }

    const configFileText = ts.sys.readFile(configFileName);
    if (!configFileText) {
        throw new Error(`Could not read file ${configFileName}`);
    }

    const { config, error } = ts.parseConfigFileTextToJson(configFileName, configFileText);

    if (error) {
        throw new Error(`Error parsing tsconfig.json: ${error.messageText}`);
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(configFileName)
    );

    parsedCommandLine.options.verbatimModuleSyntax = false;
    parsedCommandLine.options.sourceMap = false;
    parsedCommandLine.options.declaration = false;
    parsedCommandLine.options.declarationMap = false;

    fs.writeFileSync("tsconfig.json", JSON.stringify(parsedCommandLine, null, 4), { flag: "w", flush: true });
}

async function runPostSetupScripts({ enclaveType }: { enclaveType: enclaveTemplateType }) {
    // Run the first CSS build
    await spawnChildProcess("npm", ["run", "css:build"]);
    await spawnChildProcess("npm", ["run", "ui:build"]);

    if (enclaveType == "node") {

    } else if (enclaveType == "golang") {
        await spawnChildProcess("go", ["mod", "tidy"]);
    } else if (enclaveType == "python") {
        await spawnChildProcess("uv", ["sync", "--all-groups"]);
    }
}

/**
 * Constant that stores the daisyUI plugin
 */
const daisyUiPlugin = `
@plugin "daisyui" {
    themes: light --default, dark --prefersdark;
}`

async function main() {
    await acceptUserInputs();

    // Create the destination folder
    fs.mkdirSync(applicationIdentifier, { recursive: true });
    // Copy the .vscode folder
    fs.mkdirSync(path.join(applicationIdentifier, ".vscode"), { recursive: true });
    fs.cpSync(path.join(rootFolder, ".vscode"), path.join(applicationIdentifier, ".vscode"), { recursive: true });
    fs.copyFileSync(path.join(rootFolder, "README.md"), path.join(applicationIdentifier, "README.md"));

    // Change the directory
    process.chdir(applicationIdentifier);
    // Create the package.json
    await spawnChildProcess("npm", ["init", "-y"]);

    await setupGitIgnore();
    await setupDependencies({ enclaveType: selectedEnclaveTemplate });
    await setupScripts();

    // Create the resources folder
    const { appCSSPath, distFolderName, appEntryTSPath, routerEntryTSPath } = createResourcesFolders();
    // Create the input css


    fs.writeFileSync(appCSSPath, [`@import "tailwindcss"`, daisyUiPlugin].map(a => `${a};`).join("\n"), { flag: "w", flush: true });

    await createIndexHTML({ appName: applicationName, version, enclaveName: applicationIdentifier });
    await createEntryTS({ appEntryTSPath, enclaveName: applicationIdentifier });
    await createRouterTS({ routerEntryTSPath });
    await createManifest({ appName: applicationName, version, enclaveName: applicationIdentifier, appIdentifier: `${applicationIdentifier}.enc`, enclaveType: selectedEnclaveTemplate });
    await createTestServer({ enclaveType: selectedEnclaveTemplate, enclaveName: applicationIdentifier });

    await createBuildScripts({ appCSSPath, distFolderName, appEntryTSPath, enclaveType: selectedEnclaveTemplate });
    await fixTSConfig();
    await runPostSetupScripts({ enclaveType: selectedEnclaveTemplate });
    console.log("Your app is ready! What are you going to build next?");
}

main();