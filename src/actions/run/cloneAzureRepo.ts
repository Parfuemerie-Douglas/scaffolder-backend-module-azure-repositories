/*
 * Copyright 2022 Parfümerie Douglas GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { resolveSafeChildPath } from "@backstage/backend-common";
import { InputError } from "@backstage/errors";
import { ScmIntegrationRegistry } from "@backstage/integration";
import { createTemplateAction } from "@backstage/plugin-scaffolder-backend";

import { cloneRepo } from "../helpers";

export const cloneAzureRepoAction = (options: {
  integrations: ScmIntegrationRegistry;
}) => {
  const { integrations } = options;

  return createTemplateAction<{
    remoteUrl: string;
    branch?: string;
    targetPath?: string;
    server: string;
    token?: string;
  }>({
    id: "azure:repo:clone",
    description: "Clone an Azure repository into the workspace directory.",
    schema: {
      input: {
        required: ["repoUrl", "remoteUrl"],
        type: "object",
        properties: {
          remoteUrl: {
            title: "Remote URL",
            type: "string",
            description: "The Git URL to the repository.",
          },
          branch: {
            title: "Repository Branch",
            type: "string",
            description: "The branch to checkout to.",
          },
          targetPath: {
            title: "Working Subdirectory",
            type: "string",
            description:
              "The subdirectory of the working directory to clone the repository into.",
          },
          server: {
            type: "string",
            title: "Server hostname",
            description: "The hostname of the Azure DevOps service. Defaults to dev.azure.com",
          },
          token: {
            title: "Authenticatino Token",
            type: "string",
            description: "The token to use for authorization.",
          },
        },
      },
    },
    async handler(ctx) {
      const { remoteUrl, branch, server } = ctx.input;

      const targetPath = ctx.input.targetPath ?? "./";
      const outputDir = resolveSafeChildPath(ctx.workspacePath, targetPath);

      const host = server ?? "dev.azure.com";
      const integrationConfig = integrations.azure.byHost(host);

      if (!integrationConfig) {
        throw new InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }

      if (!integrationConfig.config.token && !ctx.input.token) {
        throw new InputError(`No token provided for Azure Integration ${host}`);
      }

      const token = ctx.input.token ?? integrationConfig.config.token!;

      await cloneRepo({
        dir: outputDir,
        auth: { username: "notempty", password: token },
        logger: ctx.logger,
        remoteUrl: remoteUrl,
        branch: branch,
      });
    },
  });
};
