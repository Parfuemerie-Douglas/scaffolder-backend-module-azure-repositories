import {DefaultAzureDevOpsCredentialsProvider, ScmIntegrationRegistry} from "@backstage/integration";
import { createTemplateAction } from "@backstage/plugin-scaffolder-backend";
import {InputError} from "@backstage/errors";
import { createADOPullRequest} from "../helpers";
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";

/**
 * Creates an `ado:repo:pr` Scaffolder action.
 *
 * @remarks
 *
 * This Scaffolder action will create a PR to a repository in Azure DevOps.
 *
 * @public
 */
export const pullRequestAzureRepoAction = (options: {
  integrations: ScmIntegrationRegistry;
}) => {
  const { integrations } = options;

  return createTemplateAction<{
    organization?: string;
    sourceBranch?: string;
    targetBranch?: string;
    title: string;
    repoId: string;
    project?: string;
    supportsIterations?: boolean;
    server: string;
    token?: string;
  }>({
    id: 'azure:repo:pr',
    description: 'Create a PR to a repository in Azure DevOps.',
    schema: {
      input: {
        type: 'object',
        required: ['repoId', 'title'],
        properties: {
          organization: {
            title: 'Organization Name',
            type: 'string',
            description: 'The name of the organization in Azure DevOps.',
          },
          sourceBranch: {
            title: 'Source Branch',
            type: 'string',
            description: 'The branch to merge into the source.',
          },
          targetBranch: {
            title: 'Target Branch',
            type: 'string',
            description: "The branch to merge into (default: main).",
          },
          title: {
            title: 'Title',
            description: 'The title of the pull request.',
            type: 'string',
          },
          repoId: {
            title: 'Remote Repo ID',
            description: 'Repo ID of the pull request.',
            type: 'string',
          },
          project: {
            title: 'ADO Project',
            description: 'The Project in Azure DevOps.',
            type: 'string',
          },
          supportsIterations: {
            title: 'Supports Iterations',
            description: 'Whether or not the PR supports iterations.',
            type: 'boolean',
          },
          server: {
            type: "string",
            title: "Server hostname",
            description: "The hostname of the Azure DevOps service. Defaults to dev.azure.com",
          },
          token: {
            title: 'Authentication Token',
            type: 'string',
            description: 'The token to use for authorization.',
          }
        }
      },
      output: {
        type: 'number',
        properties: {
          pullRequestId: {
            title: 'The ID of the created pull request',
            type: 'number'
          }
        }
      }
    },
    async handler(ctx) {
      const { title, repoId, server, project, supportsIterations } = ctx.input;

      const sourceBranch = `refs/heads/${ctx.input.sourceBranch}` ?? `refs/heads/scaffolder`;
      const targetBranch = `refs/heads/${ctx.input.targetBranch}` ?? `refs/heads/main`;

      const host = server ?? "dev.azure.com";
      const provider = DefaultAzureDevOpsCredentialsProvider.fromIntegrations(integrations);
      const url = `https://${host}/${ctx.input.organization}`;
      const credentials = await provider.getCredentials({ url: url });

      const org = ctx.input.organization ?? "not-empty";
      const token = ctx.input.token ?? credentials?.token;

      if (!token) {
        throw new InputError(`No token credentials provided for ${url}`);
      }

      const pullRequest: GitInterfaces.GitPullRequest = {
        sourceRefName: sourceBranch,
        targetRefName: targetBranch,
        title: title,
      } as GitInterfaces.GitPullRequest;

      const pullRequestId = await createADOPullRequest({
        gitPullRequestToCreate: pullRequest,
        server: host,
        auth: {
          org: org,
          token: token,
        },
        repoId: repoId,
        project: project,
        supportsIterations: supportsIterations,
      });

      ctx.output("pullRequestId", pullRequestId);
    },
  });
};
