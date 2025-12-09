<p align="center"> <a href="https://scailo.com" target="_blank"> <img src="https://pub-fbb2435be97c492d8ece0578844483ea.r2.dev/scailo-logo.png" alt="Scailo Logo" width="200"> </a> </p>

<h1 align="center">Scailo Apps Starter Kit</h1>

<p align="center">
<a href="https://www.npmjs.com/package/@kernelminds/create-enclave">
<img src="https://img.shields.io/npm/v/%40kernelminds/create-enclave.svg" alt="NPM Version">
</a>
</p>

# Scailo Application Starter Kit

#### Welcome to the official starter kit for building custom applications and widgets on the Scailo platform. This kit provides a complete project scaffold using TypeScript and TailwindCSS (with DaisyUI), allowing you to get up and running in minutes.

## Features

- TypeScript: Write robust, type-safe code for your application logic.

- TailwindCSS: A utility-first CSS framework for rapid UI development.

- DaisyUI: A component library for TailwindCSS to build beautiful interfaces quickly.

- Development Server: A built-in proxy server to seamlessly connect with the Scailo API during local development.

- Build & Packaging Scripts: Simple commands to watch for changes, build your assets, and package your application for deployment.


## Getting Started

Follow these steps to create your new Scailo application.

### Prerequisites

Make sure you have `nodejs` and `npm` installed on your system.

### Scaffolding a New Application

To create a new project, run the following command in your terminal:

```bash
npx @kernelminds/create-enclave@latest
```

You will be prompted to enter the following information:

1. **Application Name**: The user-facing name of your application as it will appear on Scailo.

```bash
? Enter Application Name: My Awesome Scailo App
```

2. **Application Identifier**: A unique internal identifier for your application. This is used by Scailo to track the app.

    **Important**: Please use a unique identifier. Deploying a new app with an existing identifier will overwrite the current application on Scailo.

```bash
? Enter Application Identifier: my-awesome-scailo-app-123
```

3. **Initial Version**: The starting version number for your application. It must be a semantic versioning compliant string (e.g., 1.0.0).

```bash
? Enter Initial Version: 1.0.0
```

Once completed, a new directory with your application name will be created. Navigate into it to begin development.

```bash
cd "My Awesome Scailo App"
npm install
```

## Development Workflow

#### 1. Configure the Development Server

The starter kit includes a local proxy server to forward API requests to your Scailo instance during development.

1. Locate the `.env` file in the root of your project.

2. Update the file with your Scailo credentials and local server configuration:

```bash
# The full URL of the Scailo API
upstreamAPI=https://your-scailo-instance.scailo.com/api

# The port for your local development server
port=8080

# Your Scailo username for proxying requests
username=your_username

# Your Scailo password for proxying requests
password=your_password
```

#### 2. Run the Development Server

```bash
npm run dev:serve
```

This command will:

- Read the configuration from your .env file.

- Start a local server on the specified port.

- Serve the main index.html file on the / route (e.g., http://localhost:8080).

- Proxy any other incoming requests to the upstreamAPI using your credentials.

#### 3. Watch and build TypeScript and CSS files

```bash
npm run dev:watch
```

This command executes `npm run css:watch` and `npm run ui:watch` `concurrently`.

#### 4. Develop Your Application

With the server running, you can now start building your application. You will likely need two additional terminal windows for the watch commands.

##### Styling (CSS)

- To add custom styles or configure TailwindCSS, edit the resources/src/css/app.css file.

- To automatically compile your CSS changes, run the watcher:

```bash
npm run css:watch
```

- This will generate the output file resources/dist/css/bundle.css, which is already linked in index.html.

##### Application Logic (TypeScript)

- The main entry point for your UI logic is resources/src/ts/app.ts.

- You can create additional TypeScript modules and import them into app.ts.

- To automatically compile your TypeScript code into a single JavaScript bundle, run the watcher:

```bash
npm run ui:watch
```

- This generates the minified output file resources/dist/js/bundle.src.min.js, which is already linked in index.html.

### Customizing the Application Logo

To set a custom logo for your application:

- Place your logo image file inside the `resources/dist/img/` folder.

- Open the `MANIFEST.yaml` file in the project root.

- Update the `resources.logos` property to point to your new logo file name.

```yaml
resources:
  logos:
    # Example for a logo named 'my-logo.png'
    - "resources/dist/img/my-logo.png"
```

### Authentication and Authorization

It is crucial to understand how authentication works in development versus production.

- **During Development**: The username and password in your .env file are used by the local proxy server (server.ts) to make authenticated API calls to Scailo. This is for convenience and local testing only.

- **In Production (on Scailo)**: When your application is built and deployed to the Scailo platform, it does not use the .env credentials. Instead, the application automatically assumes the roles, permissions, and identity of the currently logged-in Scailo user who is executing the app.

### Packaging for Deployment

When your application is ready for deployment, you need to create a final build package.

1. Run the packaging command:

```bash
npm run package
```

2. You will be prompted to enter a new version for the application.

    **Note**: The new version must be a valid semantic version and must be greater than the current version specified in the `app_version` property of your `MANIFEST.yaml` file.

This script will bundle all your assets and create the final distributable package required for deployment on Scailo.

## NPM Scripts Summary

Here is a quick reference for the available commands:

| Command           | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| npm run dev:serve | Starts the local development server and API proxy.                          |
| npm run dev:watch | Watches for changes in CSS files and TypeScript files concurrently.         |
| npm run css:watch | Watches for changes in CSS files and rebuilds the bundle.css on save.       |
| npm run ui:watch  | Watches for changes in TypeScript files and rebuilds the JS bundle on save. |
| npm run package   | Bundles and packages the application for production deployment.             |
