declare const __DISABLE_AUTH__: string | undefined;

const getBundledDisableAuth = (): string | undefined => {
  if (typeof __DISABLE_AUTH__ === 'undefined') return undefined;
  return __DISABLE_AUTH__;
};

export const isAuthDisabled = (): boolean => {
  const bundledDisableAuth = getBundledDisableAuth();

  if (bundledDisableAuth !== undefined) {
    return bundledDisableAuth === 'true';
  }

  return process.env['DISABLE_AUTH'] === 'true';
};
