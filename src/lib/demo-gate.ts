/** Shape of `GET /api/session` that the browser uses to decide whether to show the login gate. */
export type DemoGateConfig = {
  accessTokenRequired?: boolean;
  demoPasswordRequired?: boolean;
  demoSessionActive?: boolean;
};

/**
 * The gate shows only on a gated host (session token + demo password configured)
 * and only while this browser has no valid demo-session cookie. A returning
 * user who already logged in keeps working across / and /settings.
 */
export function needsDemoLogin(config: DemoGateConfig) {
  return Boolean(
    config.accessTokenRequired && config.demoPasswordRequired && !config.demoSessionActive,
  );
}
