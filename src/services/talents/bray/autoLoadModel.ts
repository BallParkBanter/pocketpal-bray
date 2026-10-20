// Bray fork: Bo should never have to load a model. On a cold start, if no
// model is active (and upstream's auto-release reload did not bring one back),
// load the last model he used. Never throws.
interface ModelLike {
  id: string;
}

export interface AutoLoadStore<M extends ModelLike> {
  activeModelId: string | undefined;
  isContextLoading: boolean;
  lastUsedModel: M | undefined;
  selectModel: (model: M) => Promise<void>;
}

/** Returns the id it started loading, or undefined. */
export async function autoLoadLastUsedModel<M extends ModelLike>(
  store: AutoLoadStore<M>,
): Promise<string | undefined> {
  try {
    const model = store.lastUsedModel;
    if (store.activeModelId || store.isContextLoading || !model) {
      return undefined;
    }
    await store.selectModel(model);
    return model.id;
  } catch (error) {
    console.error('Bray: auto-loading the last model failed:', error);
    return undefined;
  }
}
