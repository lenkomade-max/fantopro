export class OverlayEffects {
  static async render(
    config: any,
    data: any,
    id: string,
    orientation: any,
  ): Promise<void> {
    // Lazy runtime import to avoid cross-package TS rootDir issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OverlayRemotion } = require("../../../src/short-creator/libraries/OverlayRemotion");
    const overlayRemotion = await OverlayRemotion.init(config);
    await overlayRemotion.render(
      data,
      id,
      orientation,
      {
        perOverlayTimeout: 15000,
        totalTimeout: 120000,
        enableRetry: true,
        maxRetries: 1,
      }
    );
  }
}
