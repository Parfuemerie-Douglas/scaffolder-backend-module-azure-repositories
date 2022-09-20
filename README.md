# scaffolder-backend-module-azure-repositories

Welcome to the Microsoft Azure repository actions for the `scaffolder-backend`.

This plugin contains a collection of actions:

- `azure:repo:clone`
- `azure:repo:push`

## Getting started

Create your Backstage application using the Backstage CLI as described here:
<https://backstage.io/docs/getting-started/create-an-app>.

> Note: If you are using this plugin in a Backstage monorepo that contains the
> code for `@backstage/plugin-scaffolder-backend`, you need to modify your
> internal build processes to transpile files from the `node_modules` folder as
> well.

You need to configure the actions in your backend:

## From your Backstage root directory

```sh
# From your Backstage root directory
yarn add --cwd packages/backend @parfuemerie-douglas/scaffolder-backend-module-azure-repositories
```

Configure the actions (you can check the
[docs](https://backstage.io/docs/features/software-templates/writing-custom-actions#registering-custom-actions)
to see all options):

```typescript
// packages/backend/src/plugins/scaffolder.ts

import { CatalogClient } from '@backstage/catalog-client';
import { ScmIntegrations } from "@backstage/integration";

import {
  cloneAzureRepoAction,
  pushAzureRepoAction
} from "@parfuemerie-douglas/scaffolder-backend-module-azure-repositories";

import { Router } from 'express';

import type { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({
    discoveryApi: env.discovery,
  });

const integrations = ScmIntegrations.fromConfig(env.config);

const actions = [
  cloneAzureRepoAction({ integrations }),
  pushAzureRepoAction({ integrations, config: env.config }),
  ...createBuiltInActions({
    containerRunner,
    catalogClient,
    integrations,
    config: env.config,
    reader: env.reader,
  }),
];

return await createRouter({
  containerRunner,
  catalogClient,
  actions,
  logger: env.logger,
  config: env.config,
  database: env.database,
  reader: env.reader,
});
```

The Azure repository actions use an [Azure PAT (personal access
token)](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
for authorization. The PAT requires `Read` permission for `Code` for the
`azure:repo:clone` action. For the `azure:repo:push` action the PAT requires
`Read & write` permission for `Code`. Simply add the PAT to your
`app-config.yaml`:

```yaml
# app-config.yaml

integrations:
  azure:
    - host: dev.azure.com
      token: ${AZURE_TOKEN}
```

Read more on integrations in Backstage in the [Integrations
documentation](https://backstage.io/docs/integrations/).

## Using the template

After loading and configuring the Azure repository template actions, you can use
the actions in your template:

```yaml
# template.yaml

apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: azure-repo-demo
  title: Azure Repository Test
  description: Clone and push to an Azure repository example.
spec:
  owner: parfuemerie-douglas
  type: service

  parameters:
    - title: Fill in some steps
      required:
        - name
        - owner
      properties:
        name:
          title: Project name
          type: string
          description: Choose a unique project name.
          ui:field: EntityNamePicker
          ui:autofocus: true
        owner:
          title: Owner
          type: string
          description: Select an owner for the Backstage component.
          ui:field: OwnerPicker
          ui:options:
            allowedKinds:
              - Group

  steps:
    - id: cloneAzureRepo
      name: Clone Azure Repo
      action: azure:repo:clone
      input:
        remoteUrl: "https://<MY_AZURE_ORGANIZATION>@dev.azure.com/<MY_AZURE_ORGANIZATION>/<MY_AZURE_PROJECT>/_git/<MY_AZURE_REPOSITORY>"
        branch: "main"
        targetPath: ./sub-directory

    - id: fetch
      name: Template Skeleton
      action: fetch:template
      input:
        url: ./skeleton
        targetPath: ./sub-directory
        values:
          name: ${{ parameters.name }}
          owner: ${{ parameters.owner }}

    - id: pushAzureRepo
      name: Push to Remote Azure Repo
      action: azure:repo:push
      input:
        branch: "main"
        sourcePath: ./sub-directory
        gitCommitMessage: Add ${{ parameters.name }} project files

    - id: register
      name: Register
      action: catalog:register
      input:
        repoContentsUrl: "dev.azure.com?owner=<MY_AZURE_PROJECT>&repo=<MY_AZURE_REPOSITORY>&organization=<MY_AZURE_ORGANIZATION>"
        catalogInfoPath: "/catalog-info.yaml"

  output:
    links:
      - title: Repository
        url: "dev.azure.com?owner=<MY_AZURE_PROJECT>&repo=<MY_AZURE_REPOSITORY>&organization=<MY_AZURE_ORGANIZATION>"
      - title: Open in catalog
        icon: catalog
        entityRef: ${{ steps.register.output.entityRef }}
```

Replace `<MY_AZURE_ORGANIZATION>` with the name of your Azure DevOps
organization, `<MY_AZURE_PROJECT>` with the name of your Azure DevOps project,
and `<MY_AZURE_REPOSITORY>` with the name of your Azure DevOps repository.

You can find a list of all registred actions including their parameters at the
`/create/actions` route in your Backstage application.
