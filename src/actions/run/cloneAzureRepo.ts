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

import { resolveSafeChildPath } from "@backstage/backend-plugin-api";
import { InputError } from "@backstage/errors";
import {
  DefaultAzureDevOpsCredentialsProvider,
  ScmIntegrationRegistry,
} from "@backstage/integration";
import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

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
        required: ["remoteUrl"],
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
            description:
              "The hostname of the Azure DevOps service. Defaults to dev.azure.com",
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
      const { remoteUrl, branch } = ctx.input;

      const targetPath = ctx.input.targetPath ?? "./";
      const outputDir = resolveSafeChildPath(ctx.workspacePath, targetPath);

      const provider =
        DefaultAzureDevOpsCredentialsProvider.fromIntegrations(integrations);
      const credentials = await provider.getCredentials({ url: remoteUrl });

      let auth: { username: string; password: string } | { token: string };
      if (ctx.input.token) {
        auth = { username: "not-empty", password: ctx.input.token };
      } else if (credentials?.type === "pat") {
        auth = { username: "not-empty", password: credentials.token };
      } else if (credentials?.type === "bearer") {
        auth = { token: credentials.token };
      } else {
        throw new InputError(
          `No token credentials provided for Azure repository ${remoteUrl}`
        );
      }

      await cloneRepo({
        dir: outputDir,
        auth: auth,
        logger: ctx.logger,
        remoteUrl: remoteUrl,
        branch: branch,
      });
    },
  });
};
