'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var backendPluginApi = require('@backstage/backend-plugin-api');
var integration = require('@backstage/integration');
var errors = require('@backstage/errors');
var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var backendCommon = require('@backstage/backend-common');
var azdev = require('azure-devops-node-api');
var cliCommon = require('@backstage/cli-common');
var path = require('path');

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var azdev__namespace = /*#__PURE__*/_interopNamespaceCompat(azdev);

async function cloneRepo({
  dir,
  auth,
  logger,
  remote = "origin",
  remoteUrl,
  branch = "main"
}) {
  const git = backendCommon.Git.fromAuth({
    ...auth,
    logger
  });
  await git.clone({
    url: remoteUrl,
    dir,
    ref: branch,
    noCheckout: false,
    depth: 1
  });
  await git.addRemote({
    dir,
    remote,
    url: remoteUrl
  });
}
async function commitAndPushBranch({
  dir,
  credentialsProvider,
  logger,
  remote = "origin",
  commitMessage,
  gitAuthorInfo,
  branch = "scaffolder"
}) {
  const authorInfo = {
    name: gitAuthorInfo?.name ?? "Scaffolder",
    email: gitAuthorInfo?.email ?? "scaffolder@backstage.io"
  };
  const git = backendCommon.Git.fromAuth({
    onAuth: async (url) => {
      const credentials = await credentialsProvider.getCredentials({ url });
      logger.info(`Using ${credentials?.type} credentials for ${url}`);
      if (credentials?.type === "pat") {
        return { username: "not-empty", password: credentials.token };
      } else if (credentials?.type === "bearer") {
        return {
          headers: {
            Authorization: `Bearer ${credentials.token}`
          }
        };
      }
      throw new errors.InputError(`No token credentials provided for ${url}`);
    },
    logger
  });
  const currentBranch = await git.currentBranch({ dir });
  logger.info(`Current branch is ${currentBranch}`);
  logger.info(`Target branch is ${branch}`);
  if (currentBranch !== branch) {
    try {
      await git.branch({
        dir,
        ref: branch
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AlreadyExistsError") ; else {
        throw err;
      }
    }
    await git.checkout({
      dir,
      ref: branch
    });
  }
  await git.add({
    dir,
    filepath: "."
  });
  await git.commit({
    dir,
    message: commitMessage,
    author: authorInfo,
    committer: authorInfo
  });
  await git.push({
    dir,
    remote,
    remoteRef: `refs/heads/${branch}`
  });
}
async function createADOPullRequest({
  gitPullRequestToCreate,
  server,
  auth,
  repoId,
  project,
  supportsIterations
}) {
  const url = `https://${server}/`;
  const orgUrl = url + auth.org;
  const token = auth.token || "";
  const authHandler = azdev__namespace.getHandlerFromToken(token);
  const connection = new azdev__namespace.WebApi(orgUrl, authHandler);
  const gitApiObject = await connection.getGitApi();
  const pr = await gitApiObject.createPullRequest(gitPullRequestToCreate, repoId, project, supportsIterations);
  return pr;
}
async function updateADOPullRequest({
  gitPullRequestToUpdate,
  server,
  auth,
  repoId,
  project,
  pullRequestId
}) {
  const url = `https://${server}/`;
  const orgUrl = url + auth.org;
  const token = auth.token || "";
  const authHandler = azdev__namespace.getHandlerFromToken(token);
  const connection = new azdev__namespace.WebApi(orgUrl, authHandler);
  const gitApiObject = await connection.getGitApi();
  await gitApiObject.updatePullRequest(gitPullRequestToUpdate, repoId, pullRequestId, project);
}

const cloneAzureRepoAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "azure:repo:clone",
    description: "Clone an Azure repository into the workspace directory.",
    schema: {
      input: {
        required: ["remoteUrl"],
        type: "object",
        properties: {
          remoteUrl: {
            title: "Remote URL",
            type: "string",
            description: "The Git URL to the repository."
          },
          branch: {
            title: "Repository Branch",
            type: "string",
            description: "The branch to checkout to."
          },
          targetPath: {
            title: "Working Subdirectory",
            type: "string",
            description: "The subdirectory of the working directory to clone the repository into."
          },
          server: {
            type: "string",
            title: "Server hostname",
            description: "The hostname of the Azure DevOps service. Defaults to dev.azure.com"
          },
          token: {
            title: "Authenticatino Token",
            type: "string",
            description: "The token to use for authorization."
          }
        }
      }
    },
    async handler(ctx) {
      const { remoteUrl, branch } = ctx.input;
      const targetPath = ctx.input.targetPath ?? "./";
      const outputDir = backendPluginApi.resolveSafeChildPath(ctx.workspacePath, targetPath);
      const provider = integration.DefaultAzureDevOpsCredentialsProvider.fromIntegrations(integrations);
      const credentials = await provider.getCredentials({ url: remoteUrl });
      let auth;
      if (ctx.input.token) {
        auth = { username: "not-empty", password: ctx.input.token };
      } else if (credentials?.type === "pat") {
        auth = { username: "not-empty", password: credentials.token };
      } else if (credentials?.type === "bearer") {
        auth = { token: credentials.token };
      } else {
        throw new errors.InputError(
          `No token credentials provided for Azure repository ${remoteUrl}`
        );
      }
      await cloneRepo({
        dir: outputDir,
        auth,
        logger: ctx.logger,
        remoteUrl,
        branch
      });
    }
  });
};

const getRepoSourceDirectory = (workspacePath, sourcePath) => {
  if (sourcePath) {
    const safeSuffix = path.normalize(sourcePath).replace(
      /^(\.\.(\/|\\|$))+/,
      ""
    );
    const path$1 = path.join(workspacePath, safeSuffix);
    if (!cliCommon.isChildPath(workspacePath, path$1)) {
      throw new Error("Invalid source path");
    }
    return path$1;
  }
  return workspacePath;
};

const pushAzureRepoAction = (options) => {
  const { integrations, config } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "azure:repo:push",
    description: "Push the content in the workspace to a remote Azure repository.",
    schema: {
      input: {
        required: [],
        type: "object",
        properties: {
          branch: {
            title: "Repository Branch",
            type: "string",
            description: "The branch to checkout to."
          },
          sourcePath: {
            type: "string",
            title: "Working Subdirectory",
            description: "The subdirectory of the working directory containing the repository."
          },
          gitCommitMessage: {
            title: "Git Commit Message",
            type: "string",
            description: "Sets the commit message on the repository. The default value is 'Initial commit'"
          },
          gitAuthorName: {
            title: "Default Author Name",
            type: "string",
            description: "Sets the default author name for the commit. The default value is 'Scaffolder'."
          },
          gitAuthorEmail: {
            title: "Default Author Email",
            type: "string",
            description: "Sets the default author email for the commit."
          }
        }
      }
    },
    async handler(ctx) {
      const { branch, gitCommitMessage, gitAuthorName, gitAuthorEmail } = ctx.input;
      const sourcePath = getRepoSourceDirectory(
        ctx.workspacePath,
        ctx.input.sourcePath
      );
      const gitAuthorInfo = {
        name: gitAuthorName ? gitAuthorName : config.getOptionalString("scaffolder.defaultAuthor.name"),
        email: gitAuthorEmail ? gitAuthorEmail : config.getOptionalString("scaffolder.defaultAuthor.email")
      };
      await commitAndPushBranch({
        dir: sourcePath,
        credentialsProvider: integration.DefaultAzureDevOpsCredentialsProvider.fromIntegrations(integrations),
        logger: ctx.logger,
        commitMessage: gitCommitMessage ? gitCommitMessage : config.getOptionalString("scaffolder.defaultCommitMessage") || "Initial commit",
        gitAuthorInfo,
        branch
      });
    }
  });
};

const pullRequestAzureRepoAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "azure:repo:pr",
    description: "Create a PR to a repository in Azure DevOps.",
    schema: {
      input: {
        type: "object",
        required: ["repoId", "title"],
        properties: {
          organization: {
            title: "Organization Name",
            type: "string",
            description: "The name of the organization in Azure DevOps."
          },
          sourceBranch: {
            title: "Source Branch",
            type: "string",
            description: "The branch to merge into the source."
          },
          targetBranch: {
            title: "Target Branch",
            type: "string",
            description: "The branch to merge into (default: main)."
          },
          title: {
            title: "Title",
            description: "The title of the pull request.",
            type: "string"
          },
          description: {
            title: "Description",
            description: "The description of the pull request.",
            type: "string"
          },
          repoId: {
            title: "Remote Repo ID",
            description: "Repo ID of the pull request.",
            type: "string"
          },
          project: {
            title: "ADO Project",
            description: "The Project in Azure DevOps.",
            type: "string"
          },
          supportsIterations: {
            title: "Supports Iterations",
            description: "Whether or not the PR supports iterations.",
            type: "boolean"
          },
          server: {
            type: "string",
            title: "Server hostname",
            description: "The hostname of the Azure DevOps service. Defaults to dev.azure.com"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization."
          },
          autoComplete: {
            title: "Enable auto-completion",
            description: "Enable auto-completion of the pull request once policies are met",
            type: "boolean"
          }
        }
      },
      output: {
        type: "number",
        properties: {
          pullRequestId: {
            title: "The ID of the created pull request",
            type: "number"
          }
        }
      }
    },
    async handler(ctx) {
      const { title, repoId, server, project, supportsIterations } = ctx.input;
      const sourceBranch = `refs/heads/${ctx.input.sourceBranch}` ?? `refs/heads/scaffolder`;
      const targetBranch = `refs/heads/${ctx.input.targetBranch}` ?? `refs/heads/main`;
      const host = server ?? "dev.azure.com";
      const provider = integration.DefaultAzureDevOpsCredentialsProvider.fromIntegrations(integrations);
      const url = `https://${host}/${ctx.input.organization}`;
      const credentials = await provider.getCredentials({ url });
      const org = ctx.input.organization ?? "not-empty";
      const token = ctx.input.token ?? credentials?.token;
      const description = ctx.input.description ?? "";
      const autoComplete = ctx.input.autoComplete ?? false;
      if (!token) {
        throw new errors.InputError(`No token credentials provided for ${url}`);
      }
      const pullRequest = {
        sourceRefName: sourceBranch,
        targetRefName: targetBranch,
        title,
        description
      };
      const pullRequestResponse = await createADOPullRequest({
        gitPullRequestToCreate: pullRequest,
        server: host,
        auth: {
          org,
          token
        },
        repoId,
        project,
        supportsIterations
      });
      if (autoComplete) {
        const updateProperties = {
          autoCompleteSetBy: { id: pullRequestResponse.createdBy?.id },
          // the idea here is that if you want to fire-and-forget the PR by setting autocomplete, you don't also want
          // the branch to stick around afterwards.
          completionOptions: {
            deleteSourceBranch: true
          }
        };
        await updateADOPullRequest({
          gitPullRequestToUpdate: updateProperties,
          server: host,
          auth: {
            org,
            token
          },
          repoId,
          project,
          pullRequestId: pullRequestResponse.pullRequestId
        });
      }
      ctx.output("pullRequestId", pullRequestResponse.pullRequestId);
    }
  });
};

const scaffolderModuleAzureRepositories = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "azure-repos",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config }) {
        const integrations = integration.ScmIntegrations.fromConfig(config);
        scaffolder.addActions(cloneAzureRepoAction({ integrations }), pushAzureRepoAction({ integrations, config }), pullRequestAzureRepoAction({ integrations }));
      }
    });
  }
});

exports.cloneAzureRepoAction = cloneAzureRepoAction;
exports.default = scaffolderModuleAzureRepositories;
exports.pullRequestAzureRepoAction = pullRequestAzureRepoAction;
exports.pushAzureRepoAction = pushAzureRepoAction;
//# sourceMappingURL=index.cjs.js.map
