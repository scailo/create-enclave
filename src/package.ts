#!/usr/bin/env node

import child_process = require("child_process");
import path = require("path");
import prompt = require('@inquirer/prompts');
import YAML = require('yaml');
import fs = require("fs");
import semver = require("semver");
import AdmZip = require("adm-zip");
import favicons = require("favicons");

let manifestFile = "MANIFEST.yaml";
let distFolder = "dist";
let nextVersion = "";

async function loadManifest() {
    const file = fs.readFileSync(manifestFile, 'utf8')
    return YAML.parse(file);
}

// Supports both --key=value and --key value formats
function parseArgs() {
    const args = process.argv.slice(2);

    for (let i = 0; i < args.length; i++) {
        const arg = args[i] || "";
        let key = "", value = "";

        // Check for the "=" syntax
        if (arg.includes('=')) {
            const parts = arg.split('=');
            key = parts[0] || "";
            value = parts[1] || "";
        } else {
            key = arg;
            value = args[i + 1] || "";
            // Move index forward because we are consuming the next element as a value
            i++;
        }

        // Helper to check for specific flags
        const isFlag = (long: string, short: string) => key === long || key === short;

        if (isFlag('--manifest', '-m')) {
            manifestFile = value || "MANIFEST.yaml";
        } else if (isFlag('--dist', '-d')) {
            distFolder = value || "dist";
        } else if (isFlag('--version', '-v')) {
            nextVersion = value || "";
        }
    }
}

async function acceptUserInputs({ existingVersion }: { existingVersion: string }) {
    let userEnteredVersion = "";
    if (nextVersion.length > 0) {
        userEnteredVersion = nextVersion;
    } else {
        nextVersion = semver.inc(existingVersion, "patch") || "0.0.1";
        userEnteredVersion = (await prompt.input({
            message: "Current version: " + existingVersion + ". Enter the Next Version (Semver Format): ",
            default: nextVersion,
            required: true,
            validate: input => input.length > 0
        })).trim();
    }

    if (!semver.valid(userEnteredVersion)) {
        console.log("Invalid semver: " + userEnteredVersion);
        process.exit(1);
    }

    if (semver.compare(userEnteredVersion, existingVersion) <= 0) {
        console.log(`Version should be greater than ${existingVersion}`);
        process.exit(1);
    } else {

    }

    return userEnteredVersion;
}

function spawnChildProcess(command: string, args: string[] = [], options = {}) {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn(command, args, { ...options, shell: process.platform === "win32" ? true : undefined });

        // Optional: Log stdout and stderr for debugging
        child.stdout.on('data', (data) => {
            console.log(`${data}`);
        });

        // child.stderr.on('data', (data) => {
        //     console.error(`stderr: ${data}`);
        // });

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

async function generateSimpleFavicon({ sourceFile, outputDir, fileName }: { sourceFile: string, outputDir: string, fileName: string }) {
    try {
        // 1. Configure to only generate the standard favicon
        console.log('Generating favicon.ico...');
        const response = await favicons.favicons(sourceFile, {
            icons: {
                android: false,
                appleIcon: false,
                appleStartup: false,
                favicons: true, // This enables the .ico file
                windows: false,
                yandex: false
            }
        });

        // 2. Find the specific .ico file in the response images array
        const favicon = response.images.find(img => img.name === "favicon.ico");

        if (favicon) {
            await fs.writeFileSync(path.join(outputDir, fileName), favicon.contents);
            console.log(`Success! Created: ${path.join(outputDir, fileName)}`);
        } else {
            console.error('Could not find favicon.ico in the generated output.');
        }

    } catch (error) {
        console.error('Generation failed:', error);
    }
}

interface MANIFEST_ENV {
    /**The name of the environment variable */
    name: string;
    /**The value of the environment variable */
    value: string;
    /**Stores if the environment variable is a secret */
    is_secret: boolean;
}

interface MANIFEST {
    manifest_version: string;
    enclave_runtime: "node" | "golang" | "python";
    app_version: string;
    app_name: string;
    enclave_name: string;
    app_unique_identifier: string;
    start_exec: string;
    entry_point_management: "platform_redirect" | "direct_url";
    env_variables: MANIFEST_ENV[];
    resources: {
        logos: string[];
        folders: string[];
        files: string[];
    }
}


async function main() {
    parseArgs();
    let manifest: MANIFEST = await loadManifest();
    let userEnteredVersion = await acceptUserInputs({ existingVersion: manifest.app_version });
    if (manifest.entry_point_management !== "platform_redirect" && manifest.entry_point_management !== "direct_url") {
        console.log("Invalid entry point: " + manifest.entry_point_management + ". Should be either 'platform_redirect' or 'direct_url'");
        process.exit(1);
    }

    manifest.app_version = userEnteredVersion;
    fs.writeFileSync(manifestFile, YAML.stringify(manifest, { indent: 4 }));

    // Create the favicon here
    await generateSimpleFavicon({ sourceFile: path.join("resources", "dist", "img", "logo.png"), outputDir: path.join("resources", "dist", "img"), fileName: "favicon.ico" });

    await spawnChildProcess("npm", ["run", "css:build"]);
    await spawnChildProcess("npm", ["run", "ui:build"]);
    fs.mkdirSync(path.join("artifacts", "resources"), { recursive: true });
    fs.copyFileSync(manifestFile, path.join("artifacts", "MANIFEST.yaml"));

    fs.cpSync(path.join("resources", "dist"), path.join("artifacts", "resources", "dist"), { recursive: true });

    fs.copyFileSync("package.json", path.join("artifacts", "package.json"));
    fs.copyFileSync("package-lock.json", path.join("artifacts", "package-lock.json"));

    let foldersToCopy = manifest.resources.folders;
    if (foldersToCopy && foldersToCopy.length > 0) {
        for (const folder of foldersToCopy) {
            fs.mkdirSync(path.join("artifacts", folder), { recursive: true });
            fs.cpSync(path.join(folder), path.join("artifacts", folder), { recursive: true });
        }
    }

    let filesToCopy = manifest.resources.files;
    if (filesToCopy && filesToCopy.length > 0) {
        for (const file of filesToCopy) {
            fs.copyFileSync(file, path.join("artifacts", file));
        }
    }

    const currDir = process.cwd();

    process.chdir("artifacts");
    // Zip the folder
    const zip = new AdmZip();

    zip.addLocalFolder(process.cwd());
    process.chdir("..");

    fs.rmSync(path.join(distFolder), { recursive: true, force: true });
    fs.mkdirSync(path.join(distFolder), { recursive: true });
    process.chdir(distFolder);
    const outputName = `${manifest.app_name}.enc`;

    zip.writeZip(outputName);
    process.chdir(currDir);
    fs.rmSync(path.join("artifacts"), { recursive: true });

    console.log(`Successfully package: ${outputName} (${userEnteredVersion})`);
}

main();