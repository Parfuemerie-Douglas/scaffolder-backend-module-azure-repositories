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
  });

  await git.addRemote({
    dir,
    remote,
    url: remoteUrl,
  });

  await git.checkout({
    dir,
    ref: branch,
  });
}

export async function commitAndPushRepo({
  dir,
  auth,
  logger,
  remote = "origin",
  commitMessage,
  gitAuthorInfo,
  branch = "main",
}: {
  dir: string;
  auth: { username: string; password: string } | { token: string };
  logger: Logger;
  remote?: string;
  commitMessage: string;
  gitAuthorInfo?: { name?: string; email?: string };
  branch?: string;
}): Promise<void> {
  const git = Git.fromAuth({
    ...auth,
    logger,
  });

  await git.checkout({
    dir,
    ref: branch,
  });

  await git.add({
    dir,
    filepath: ".",
  });

  // use provided info if possible, otherwise use fallbacks
  const authorInfo = {
    name: gitAuthorInfo?.name ?? "Scaffolder",
    email: gitAuthorInfo?.email ?? "scaffolder@backstage.io",
  };

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
