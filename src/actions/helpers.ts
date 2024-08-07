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
import { Git } from "@backstage/backend-common";
import { Logger } from "winston";
import * as azdev from "azure-devops-node-api";
import * as GitApi from "azure-devops-node-api/GitApi";
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";

export async function cloneRepo({
  dir,
  auth,
  logger,
  remote = "origin",
  remoteUrl,
  branch = "main",
}: {
  dir: string;
  auth: { username: string; password: string } | { token: string };
  logger: Logger;
  remote?: string;
  remoteUrl: string;
  branch?: string;
}): Promise<void> {
  const git = Git.fromAuth({
    ...auth,
    logger,
  });

  await git.clone({
    url: remoteUrl,
    dir,
    ref: branch,
    noCheckout: false,
  });

  await git.addRemote({
    dir,
    remote,
    url: remoteUrl,
  });
}

export async function commitAndPushBranch({
  dir,
  auth,
  logger,
  remote = "origin",
  commitMessage,
  gitAuthorInfo,
  branch = "scaffolder",
}: {
  dir: string;
  auth: { username: string; password: string } | { token: string };
  logger: Logger;
  remote?: string;
  commitMessage: string;
  gitAuthorInfo?: { name?: string; email?: string };
  branch?: string;
}): Promise<void> {
  const authorInfo = {
    name: gitAuthorInfo?.name ?? "Scaffolder",
    email: gitAuthorInfo?.email ?? "scaffolder@backstage.io",
  };

  const git = Git.fromAuth({
    ...auth,
    logger,
  });

  const currentBranch = await git.currentBranch({ dir });

  logger.info(`Current branch is ${currentBranch}`);
  logger.info(`Target branch is ${branch}`);

  if (currentBranch !== branch) {
    try {
      await git.branch({
        dir,
        ref: branch,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AlreadyExistsError") {
        // we safely ignore this error
      } else {
        throw err;
      }
    }

    await git.checkout({
      dir,
      ref: branch,
    });
  }

  await git.add({
    dir,
    filepath: ".",
  });

  await git.commit({
    dir,
    message: commitMessage,
    author: authorInfo,
    committer: authorInfo,
  });

  await git.push({
    dir,
    remote: remote,
    remoteRef: `refs/heads/${branch}`,
  });
}

export async function createADOPullRequest({
  gitPullRequestToCreate,
  server,
  auth,
  repoId,
  project,
  supportsIterations,
}: {
  gitPullRequestToCreate: GitInterfaces.GitPullRequest;
  server: string;
  auth: { org: string; token: string };
  repoId: string;
  project?: string;
  supportsIterations?: boolean;
}): Promise<GitInterfaces.GitPullRequest> {
  const url = `https://${server}/`;
  const orgUrl = url + auth.org;
  const token: string = auth.token || ""; // process.env.AZURE_TOKEN || "";

  const authHandler = azdev.getHandlerFromToken(token);
  const connection = new azdev.WebApi(orgUrl, authHandler);

  const gitApiObject: GitApi.IGitApi = await connection.getGitApi();

  const pr = await gitApiObject.createPullRequest(
    gitPullRequestToCreate,
    repoId,
    project,
    supportsIterations
  );
  return pr;
}

export async function updateADOPullRequest({
  gitPullRequestToUpdate,
  server,
  auth,
  repoId,
  project,
  pullRequestId,
}: {
  gitPullRequestToUpdate: GitInterfaces.GitPullRequest;
  server: string;
  auth: { org: string; token: string };
  repoId: string;
  project?: string;
  pullRequestId: number;
}): Promise<void> {
  const url = `https://${server}/`;
  const orgUrl = url + auth.org;
  const token: string = auth.token || ""; // process.env.AZURE_TOKEN || "";

  const authHandler = azdev.getHandlerFromToken(token);
  const connection = new azdev.WebApi(orgUrl, authHandler);

  const gitApiObject: GitApi.IGitApi = await connection.getGitApi();

  await gitApiObject.updatePullRequest(
    gitPullRequestToUpdate,
    repoId,
    pullRequestId,
    project
  );
}
