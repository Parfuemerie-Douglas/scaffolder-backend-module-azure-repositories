import {PersonalAccessTokenCredential, ScmIntegrationRegistry} from "@backstage/integration";
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
            description: 'Whether or not the PR supports interations.',
            type: 'boolean',
          },
          server: {
            type: "string",
            title: "Server hostname",
            description: "The hostname of the Azure DevOps service. Defaults to dev.azure.com",
          },
          token: {
            title: 'Authenticatino Token',
            type: 'string',
            description: 'The token to use for authorization.',
          },
        }
      }
    },
    async handler(ctx) {
      const { title, repoId, server, project, supportsIterations } = ctx.input;

      const sourceBranch = `refs/heads/${ctx.input.sourceBranch}` ?? `refs/heads/scaffolder`;
      const targetBranch = `refs/heads/${ctx.input.targetBranch}` ?? `refs/heads/main`;

      const host = server ?? "dev.azure.com";
      const integrationConfig = integrations.azure.byHost(host);

      if (!integrationConfig) {
        throw new InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      
      const credential = integrationConfig.config.credentials?.find(credential => credential.kind === "PersonalAccessToken") as PersonalAccessTokenCredential | undefined;

      if (!credential?.personalAccessToken && !integrationConfig.config.token && !ctx.input.token) {
        throw new InputError(`No token provided for Azure Integration ${host}`);
      }

      const pullRequest: GitInterfaces.GitPullRequest = {
        sourceRefName: sourceBranch,
        targetRefName: targetBranch,
        title: title,
      } as GitInterfaces.GitPullRequest;

      const org = ctx.input.organization ?? 'notempty';
      const token = ctx.input.token ?? credential?.personalAccessToken ?? integrationConfig.config.token!;

      await createADOPullRequest({
        gitPullRequestToCreate: pullRequest,
        server: server,
        auth: { org: org, token: token },
        repoId: repoId,
        project: project,
        supportsIterations: supportsIterations,
      });
    },
  });
};
