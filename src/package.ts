#!/usr/bin/env node

import child_process = require("child_process");
import path = require("path");
import prompt = require('@inquirer/prompts');
import YAML = require('yaml');
import fs = require("fs");
import semver = require("semver");
import AdmZip = require("adm-zip");

async function loadManifest() {
    const file = fs.readFileSync('MANIFEST.yaml', 'utf8')
    return YAML.parse(file);
}

async function acceptUserInputs({ existingVersion }: { existingVersion: string }) {
    let nextVersion = semver.inc(existingVersion, "patch") || "0.0.1";
    const userEnteredVersion = (await prompt.input({
        message: "Current version: " + existingVersion + ". Enter the Next Version (Semver Format): ",
        default: nextVersion,
        required: true,
        validate: input => input.length > 0
    })).trim();

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


async function main() {
    let manifest = await loadManifest();
    let userEnteredVersion = await acceptUserInputs({ existingVersion: manifest["app_version"] });

    manifest["app_version"] = userEnteredVersion;
    fs.writeFileSync('MANIFEST.yaml', YAML.stringify(manifest, { indent: 4 }));

    await spawnChildProcess("npm", ["run", "css:build"]);
    await spawnChildProcess("npm", ["run", "ui:build"]);
    fs.mkdirSync(path.join("artifacts", "resources"), { recursive: true });
    fs.copyFileSync("MANIFEST.yaml", path.join("artifacts", "MANIFEST.yaml"));

    const entryHTML = manifest["resources"]["html_entry"];
    fs.copyFileSync(entryHTML, path.join("artifacts", entryHTML));

    fs.cpSync(path.join("resources", "dist"), path.join("artifacts", "resources", "dist"), { recursive: true });

    fs.copyFileSync("package.json", path.join("artifacts", "package.json"));
    fs.copyFileSync("package-lock.json", path.join("artifacts", "package-lock.json"));

    let foldersToCopy = manifest["resources"]["folders"] as string[];
    if (foldersToCopy && foldersToCopy.length > 0) {
        for (const folder of foldersToCopy) {
            fs.mkdirSync(path.join("artifacts", folder), { recursive: true });
            fs.cpSync(path.join(folder), path.join("artifacts", folder), { recursive: true });
        }
    }

    let filesToCopy = manifest["resources"]["files"] as string[];
    if (filesToCopy && filesToCopy.length > 0) {
        for (const file of filesToCopy) {
            fs.copyFileSync(file, path.join("artifacts", file));
        }
    }

    process.chdir("artifacts");
    // Zip the folder
    const zip = new AdmZip();

    zip.addLocalFolder(process.cwd());
    process.chdir("..");

    const outputName = `${manifest["app_name"]}.enc`;

    zip.writeZip(outputName);
    fs.rmSync(path.join("artifacts"), { recursive: true });

    console.log(`Successfully package: ${outputName} (${userEnteredVersion})`);
}

main();