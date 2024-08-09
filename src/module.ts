import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { ScmIntegrations } from '@backstage/integration';

import {
  cloneAzureRepoAction,
  pushAzureRepoAction,
  pullRequestAzureRepoAction,
} from "./actions";

export const scaffolderModuleAzureRepositories = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'azure-repos',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        const integrations = ScmIntegrations.fromConfig(config);

        scaffolder.addActions(cloneAzureRepoAction({ integrations }), pushAzureRepoAction({ integrations, config }), pullRequestAzureRepoAction({ integrations }));
      },
    });
  },
});