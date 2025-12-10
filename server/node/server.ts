import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import * as fs from "fs";
import { createConnectTransport } from "@connectrpc/connect-node";
import { getScailoClientForLoginService } from "@kernelminds/scailo-sdk";

const ENCLAVE_NAME = (process.env.ENCLAVE_NAME || "").trim();
const UPSTREAM_API = (process.env.UPSTREAM_API || "").trim();
const PORT = parseInt(process.env.PORT || "0");
const USERNAME = (process.env.USERNAME || "").trim();
const PASSWORD = (process.env.PASSWORD || "").trim();

if (ENCLAVE_NAME == undefined || ENCLAVE_NAME == null || ENCLAVE_NAME == "") {
    console.log("ENCLAVE_NAME not set");
    process.exit(1);
}

if (UPSTREAM_API == undefined || UPSTREAM_API == null || UPSTREAM_API == "") {
    console.log("UPSTREAM_API not set");
    process.exit(1);
}

if (PORT == undefined || PORT == null || PORT == 0) {
    console.log("PORT not set");
    process.exit(1);
}

if (USERNAME == undefined || USERNAME == null || USERNAME == "") {
    console.log("USERNAME not set");
    process.exit(1);
}

if (PASSWORD == undefined || PASSWORD == null || PASSWORD == "") {
    console.log("PASSWORD not set");
    process.exit(1);
}

function getTransport(apiEndPoint: string) {
    return createConnectTransport({
        baseUrl: apiEndPoint, httpVersion: "1.1", useBinaryFormat: false, interceptors: [
            // appendAuthToken
        ]
    });
}

const transport = getTransport(UPSTREAM_API);
const server = Fastify({ logger: true, trustProxy: true });
const loginClient = getScailoClientForLoginService(transport);

let authToken = "";
let production = false;

async function loginToAPI() {
    console.log("About to login to API")
    try {
        loginClient.loginAsEmployeePrimary({ username: USERNAME, plainTextPassword: PASSWORD }).then(response => {
            authToken = response.authToken;
            console.log("Logged in with auth token: " + authToken);
        });
    } catch (e) {
        console.error(e);
    } finally {
        setTimeout(() => {
            loginToAPI();
        }, 3600 * 1000);
    }
}

// ------------------------------------------------------------------------------------------
// Register static routes here (this will serve the correct favicon from any route)
server.register(require('fastify-favicon'), { path: `./resources/dist/img`, name: 'favicon.ico', maxAge: 3600 })
// Setup static handler for web/
server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'resources', 'dist'),
    prefix: `/enclave/${ENCLAVE_NAME}/resources/dist`, // optional: default '/'
    decorateReply: false,
    constraints: {} // optional: default {}
});

let indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
server.get("/*", async (request, reply) => {
    if (!production) {
        indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
    }
    reply.header("Content-Type", "text/html");
    reply.send(replaceBundleCaches(indexPage));
});

server.get(`/enclave/${ENCLAVE_NAME}/ui`, async (request, reply) => {
    if (!production) {
        indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
    }
    reply.header("Content-Type", "text/html");
    reply.send(replaceBundleCaches(indexPage));
});

server.get(`/enclave/${ENCLAVE_NAME}/ui/*`, async (request, reply) => {
    if (!production) {
        indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
    }
    reply.header("Content-Type", "text/html");
    reply.send(replaceBundleCaches(indexPage));
});

server.get(`/enclave/${ENCLAVE_NAME}/api/random`, async (request, reply) => {
    reply.header("Content-Type", "application/json");
    reply.send({ random: Math.random() });
});

server.get(`/enclave/${ENCLAVE_NAME}/health/startup`, async (request, reply) => {
    reply.send({ status: "OK" });
});

server.get(`/enclave/${ENCLAVE_NAME}/health/liveliness`, async (request, reply) => {
    reply.send({ status: "OK" });
});

server.get(`/enclave/${ENCLAVE_NAME}/health/readiness`, async (request, reply) => {
    reply.send({ status: "OK" });
});

function replaceBundleCaches(page: string) {
    const version = new Date().toISOString();
    page = page.replace(`<link rel="preload" as="script" href="/enclave/${ENCLAVE_NAME}/resources/dist/js/bundle.src.min.js">`, `<link rel="preload" as="script" href="/enclave/${ENCLAVE_NAME}/resources/dist/js/bundle.src.min.js?v=${version}">`)
    page = page.replace(`<script src="/enclave/${ENCLAVE_NAME}/resources/dist/js/bundle.src.min.js"></script>`, `<script src="/enclave/${ENCLAVE_NAME}/resources/dist/js/bundle.src.min.js?v=${version}"></script>`)
    page = page.replace(`<link rel="stylesheet" href="/enclave/${ENCLAVE_NAME}/resources/dist/css/bundle.css">`, `<link rel="stylesheet" href="/enclave/${ENCLAVE_NAME}/resources/dist/css/bundle.css?v=${version}">`)
    return page
}

// ------------------------------------------------------------------------------------------
server.setNotFoundHandler((request, reply) => {
    reply.redirect("/");
})
// ------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------
console.log(`Listening on port ${PORT} with Production: ${production}`);
loginToAPI();
server.listen({ port: PORT, host: '0.0.0.0' });
